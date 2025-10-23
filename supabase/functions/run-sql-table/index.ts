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
    const { sql, page = 1, pageSize = 25, sort } = await req.json();

    if (!sql || typeof sql !== 'string') {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'SQL query is required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate SQL
    const trimmedSql = sql.trim().toUpperCase();
    
    if (!trimmedSql.startsWith('SELECT')) {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'Only SELECT queries are allowed' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (sql.includes(';') && sql.trim().indexOf(';') !== sql.trim().length - 1) {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'Multiple statements are not allowed' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE'];
    if (dangerousKeywords.some(keyword => trimmedSql.includes(keyword))) {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'Query contains prohibited keywords' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Connect to external PostgreSQL database
    const client = new Client(config);

    try {
      await client.connect();

      // Strip any existing LIMIT/OFFSET from the user's query
      const cleanedSql = sql.trim().replace(/;$/, '').replace(/\s+LIMIT\s+\d+(\s+OFFSET\s+\d+)?$/i, '');

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM (${cleanedSql}) as count_query`;
      const countResult = await client.queryObject(countSql);
      const total = countResult.rows && countResult.rows.length > 0 
        ? parseInt((countResult.rows[0] as any).total) 
        : 0;

      // Apply pagination
      const offset = (page - 1) * pageSize;
      const paginatedSql = `${cleanedSql} LIMIT ${pageSize} OFFSET ${offset}`;

      const result = await client.queryObject(paginatedSql);

      // Extract columns and rows
      const columns = result.rows && result.rows.length > 0 ? Object.keys(result.rows[0] as Record<string, any>) : [];
      const rows = result.rows || [];

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
        JSON.stringify({ columns, rows, columnTypes, total, page, pageSize }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (dbError: any) {
      console.error('Database query error:', dbError);
      try {
        await client.end();
      } catch (e) {
        console.error('Error closing connection:', e);
      }
      return new Response(
        JSON.stringify({ error: { code: 'EXECUTION_ERROR', message: dbError.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('Error in run-sql-table:', error);
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: error.message } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
