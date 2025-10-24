import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { sql } = await req.json();

    if (!sql || typeof sql !== 'string') {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'SQL query is required' } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Strip comments before validation
    // Remove single-line comments (-- comment)
    let sqlWithoutComments = sql.replace(/--[^\n]*(\n|$)/g, '\n');
    // Remove multi-line comments (/* comment */)
    sqlWithoutComments = sqlWithoutComments.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Validate SQL (only SELECT, no multiple statements)
    const trimmedSql = sqlWithoutComments.trim().toUpperCase();
    
    if (!trimmedSql.startsWith('SELECT')) {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'Only SELECT queries are allowed' } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (sql.includes(';') && sql.trim().indexOf(';') !== sql.trim().length - 1) {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'Multiple statements are not allowed' } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Block dangerous keywords (using word boundaries to avoid false positives with column names like "is_deleted")
    const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE'];
    const foundDangerous = dangerousKeywords.find(keyword => {
      // Use word boundary regex to match only standalone keywords, not parts of column names
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(sql);
    });
    if (foundDangerous) {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'Query contains prohibited keywords' } }),
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

      // Execute query with LIMIT 1
      const safeSql = sql.trim().replace(/;$/, '') + ' LIMIT 1';
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
