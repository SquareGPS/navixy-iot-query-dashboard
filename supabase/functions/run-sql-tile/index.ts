import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';
import { Parser } from 'https://esm.sh/node-sql-parser@5.3.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const parser = new Parser();

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

// Validate SQL using AST parsing
function validateSQL(sql: string): { valid: boolean; error?: string; sanitized?: string } {
  try {
    // Parse SQL to AST
    const ast = parser.astify(sql, { database: 'Postgresql' });
    
    // Ensure it's an array
    const statements = Array.isArray(ast) ? ast : [ast];
    
    // Only allow single SELECT statement
    if (statements.length !== 1) {
      return { valid: false, error: 'Only single statements are allowed' };
    }
    
    const stmt = statements[0];
    
    // Validate it's a SELECT statement
    if (stmt.type !== 'select') {
      return { valid: false, error: 'Only SELECT queries are allowed' };
    }
    
    // Check for dangerous operations in the SELECT
    const sqlStr = JSON.stringify(stmt);
    
    // Block write operations even in subqueries
    const dangerousPatterns = [
      'insert', 'update', 'delete', 'drop', 'alter', 'create', 
      'truncate', 'grant', 'revoke', 'copy', 'set', 'do', 'call',
      'pg_read_file', 'pg_write_file', 'pg_sleep'
    ];
    
    for (const pattern of dangerousPatterns) {
      if (sqlStr.toLowerCase().includes(`"type":"${pattern}"`)) {
        return { valid: false, error: `Prohibited operation detected: ${pattern.toUpperCase()}` };
      }
    }
    
    // Check for CTEs (WITH clauses) - they can hide write operations
    if (stmt.with) {
      return { valid: false, error: 'Common Table Expressions (WITH clauses) are not allowed' };
    }
    
    // Deparse back to SQL to sanitize
    const sanitized = parser.sqlify(stmt, { database: 'Postgresql' });
    
    return { valid: true, sanitized };
  } catch (error: any) {
    console.error('SQL parsing error:', error);
    return { valid: false, error: `Invalid SQL syntax: ${error.message}` };
  }
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

    const { sql } = await req.json();

    if (!sql || typeof sql !== 'string') {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'SQL query is required' } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate SQL using AST parser
    const validation = validateSQL(sql.trim());
    
    if (!validation.valid) {
      console.error('SQL validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: validation.error } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Use sanitized SQL from parser
    const sanitizedSql = validation.sanitized!;

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

      // Execute query with LIMIT 1 enforced
      const safeSql = sanitizedSql.replace(/;$/, '') + ' LIMIT 1';
      const result = await client.queryObject(safeSql);

      // Extract first value
      let value: number | null = null;
      if (result.rows && result.rows.length > 0) {
        const firstRow = result.rows[0] as Record<string, any>;
        const firstValue = Object.values(firstRow)[0];
        
        // Handle BigInt conversion
        if (typeof firstValue === 'bigint') {
          value = Number(firstValue);
        } else if (typeof firstValue === 'number') {
          value = firstValue;
        } else if (typeof firstValue === 'string' && !isNaN(parseFloat(firstValue))) {
          value = parseFloat(firstValue);
        } else if (firstValue === null) {
          value = null;
        }
      }

      await client.end();

      return new Response(
        JSON.stringify({ value }),
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
    console.error('Error in run-sql-tile:', error);
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: error.message } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
