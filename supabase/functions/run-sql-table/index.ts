import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map common PostgreSQL OID types to readable names
function getPostgresTypeName(oid: number): string {
  const typeMap: Record<number, string> = {
    16: 'boolean',
    20: 'bigint',
    21: 'smallint',
    23: 'integer',
    25: 'text',
    700: 'real',
    701: 'double precision',
    1043: 'varchar',
    1082: 'date',
    1114: 'timestamp',
    1184: 'timestamptz',
    1700: 'numeric',
    2950: 'uuid',
  };
  return typeMap[oid] || `type(${oid})`;
}

// Enhanced SQL validation
function validateSQL(sql: string): { valid: boolean; error?: string } {
  // Remove comments
  let cleanSql = sql.replace(/--[^\n]*(\n|$)/g, '\n');
  cleanSql = cleanSql.replace(/\/\*[\s\S]*?\*\//g, '');
  
  const trimmedSql = cleanSql.trim().toUpperCase();
  
  // Must start with SELECT
  if (!trimmedSql.startsWith('SELECT')) {
    return { valid: false, error: 'Only SELECT queries are allowed' };
  }
  
  // Check for multiple statements
  if (sql.includes(';') && sql.trim().lastIndexOf(';') !== sql.trim().length - 1) {
    return { valid: false, error: 'Multiple statements are not allowed' };
  }
  
  // Block dangerous keywords using word boundaries
  const dangerousKeywords = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 
    'TRUNCATE', 'GRANT', 'REVOKE', 'COPY', 'EXECUTE', 'CALL',
    'pg_read_file', 'pg_write_file', 'pg_sleep', 'pg_terminate_backend'
  ];
  
  for (const keyword of dangerousKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(sql)) {
      return { valid: false, error: `Prohibited operation: ${keyword}` };
    }
  }
  
  // Block CTEs that could hide write operations
  if (/\bWITH\b/i.test(sql)) {
    return { valid: false, error: 'Common Table Expressions (WITH) are not allowed' };
  }
  
  return { valid: true };
}

function parsePostgresUrl(url: string) {
  const urlObj = new URL(url);
  const sslmode = urlObj.searchParams.get('sslmode');
  
  return {
    user: decodeURIComponent(urlObj.username),
    password: decodeURIComponent(urlObj.password),
    database: urlObj.pathname.slice(1),
    hostname: urlObj.hostname,
    port: parseInt(urlObj.port) || 5432,
    tls: sslmode ? { enabled: true, enforce: sslmode === 'require' } : undefined,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client for auth verification
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid authentication token' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin or editor role
    const { data: hasPermission, error: roleError } = await supabaseClient
      .rpc('is_admin_or_editor', { _user_id: user.id });

    if (roleError || !hasPermission) {
      console.error('Authorization failed - user does not have required role:', user.id);
      return new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions. Admin or editor role required.' } }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated and authorized:', user.id);

    const { sql, page = 1, pageSize = 25, sort } = await req.json();

    if (!sql || typeof sql !== 'string') {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'SQL query is required' } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate SQL
    const validation = validateSQL(sql.trim());
    
    if (!validation.valid) {
      console.error('SQL validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: validation.error } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client to fetch external DB config
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch external DB configuration from app_settings
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('external_db_url, external_db_host, external_db_port, external_db_name, external_db_user, external_db_password, external_db_ssl')
      .eq('id', 1)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ error: { code: 'CONFIG_ERROR', message: 'Failed to fetch database configuration' } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let config;
    
    if (settings?.external_db_url) {
      config = parsePostgresUrl(settings.external_db_url);
    } else if (settings?.external_db_host && settings?.external_db_name && settings?.external_db_user) {
      config = {
        user: settings.external_db_user,
        password: settings.external_db_password || '',
        database: settings.external_db_name,
        hostname: settings.external_db_host,
        port: settings.external_db_port || 5432,
        tls: settings.external_db_ssl ? { enabled: true, enforce: true } : { enabled: false },
      };
    } else {
      return new Response(
        JSON.stringify({ error: { code: 'CONFIG_ERROR', message: 'External database not configured' } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Connect to external PostgreSQL database
    const client = new Client(config);

    try {
      await client.connect();
      
      // Set statement timeout to prevent long-running queries
      await client.queryObject('SET statement_timeout = 30000'); // 30 seconds

      // Extract LIMIT from user's query if present
      const limitMatch = sql.trim().match(/\s+LIMIT\s+(\d+)(?:\s+OFFSET\s+\d+)?(?:\s*;)?$/i);
      const userLimit = limitMatch ? parseInt(limitMatch[1]) : null;
      
      // Strip any existing LIMIT/OFFSET from the user's query
      const cleanedSql = sql.trim().replace(/;$/, '').replace(/\s+LIMIT\s+\d+(?:\s+OFFSET\s+\d+)?$/i, '');

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM (${cleanedSql}) as count_query`;
      const countResult = await client.queryObject(countSql);
      const total = countResult.rows && countResult.rows.length > 0 
        ? parseInt((countResult.rows[0] as any).total) 
        : 0;

      // Use user's LIMIT if it's smaller than pageSize, otherwise use pageSize
      const effectiveLimit = userLimit !== null && userLimit < pageSize ? userLimit : pageSize;
      
      // Apply pagination
      const offset = (page - 1) * effectiveLimit;
      const paginatedSql = `${cleanedSql} LIMIT ${effectiveLimit} OFFSET ${offset}`;

      const result = await client.queryObject(paginatedSql);

      // Extract columns and rows
      const columns = result.rows && result.rows.length > 0 ? Object.keys(result.rows[0] as Record<string, any>) : [];
      
      // Convert BigInt values to strings for JSON serialization
      const rows = (result.rows || []).map((row: any) => {
        const convertedRow: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          convertedRow[key] = typeof value === 'bigint' ? value.toString() : value;
        }
        return convertedRow;
      });

      // Get column types from the result metadata
      const columnTypes: Record<string, string> = {};
      if (result.rowDescription) {
        result.rowDescription.columns.forEach((col: any) => {
          const typeName = col.typeOid ? getPostgresTypeName(col.typeOid) : 'unknown';
          columnTypes[col.name] = typeName;
        });
      }

      await client.end();

      return new Response(
        JSON.stringify({ columns, rows, columnTypes, total, page, pageSize: effectiveLimit }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (dbError: any) {
      console.error('=== Database query error ===');
      console.error('Error message:', dbError.message);
      console.error('Error stack:', dbError.stack);
      console.error('Error details:', {
        name: dbError.name,
        fields: dbError.fields,
        severity: dbError.fields?.severity,
        code: dbError.fields?.code,
        position: dbError.fields?.position,
        file: dbError.fields?.file,
        line: dbError.fields?.line,
        routine: dbError.fields?.routine,
      });
      
      try {
        await client.end();
      } catch (e) {
        console.error('Error closing connection:', e);
      }
      
      // Build detailed error message for user
      let userMessage = dbError.message;
      if (dbError.fields?.code) {
        userMessage = `[${dbError.fields.code}] ${userMessage}`;
      }
      if (dbError.fields?.position) {
        userMessage += ` at position ${dbError.fields.position}`;
      }
      
      return new Response(
        JSON.stringify({ 
          error: { 
            code: 'EXECUTION_ERROR',
            message: userMessage,
            details: {
              sqlCode: dbError.fields?.code,
              position: dbError.fields?.position,
              severity: dbError.fields?.severity,
            }
          } 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('Error in run-sql-table:', error);
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: error.message } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
