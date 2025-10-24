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

  console.log('=== run-sql-tile: Request received ===');
  
  try {
    const { sql } = await req.json();
    console.log('SQL query:', sql);

    if (!sql || typeof sql !== 'string') {
      console.error('Invalid SQL: missing or wrong type');
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'SQL query is required' } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate SQL (only SELECT, no multiple statements)
    const trimmedSql = sql.trim().toUpperCase();
    console.log('Trimmed SQL (uppercase):', trimmedSql.substring(0, 100));
    
    if (!trimmedSql.startsWith('SELECT')) {
      console.error('SQL validation failed: not a SELECT query');
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'Only SELECT queries are allowed' } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (sql.includes(';') && sql.trim().indexOf(';') !== sql.trim().length - 1) {
      console.error('SQL validation failed: multiple statements detected');
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
      console.error('SQL validation failed: dangerous keyword found:', foundDangerous);
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'Query contains prohibited keywords' } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating Supabase client...');
    // Create Supabase client to fetch external DB config
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Fetching app_settings...');
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

    console.log('Settings retrieved:', {
      hasUrl: !!settings?.external_db_url,
      hasHost: !!settings?.external_db_host,
      hasDbName: !!settings?.external_db_name,
      hasUser: !!settings?.external_db_user
    });

    let config;
    
    if (settings?.external_db_url) {
      console.log('Using external_db_url configuration');
      config = parsePostgresUrl(settings.external_db_url);
    } else if (settings?.external_db_host && settings?.external_db_name && settings?.external_db_user) {
      console.log('Using individual connection parameters');
      config = {
        user: settings.external_db_user,
        password: settings.external_db_password || '',
        database: settings.external_db_name,
        hostname: settings.external_db_host,
        port: settings.external_db_port || 5432,
        tls: settings.external_db_ssl ? { enabled: true, enforce: true } : { enabled: false },
      };
    } else {
      console.error('Database not configured - missing required settings');
      return new Response(
        JSON.stringify({ error: { code: 'CONFIG_ERROR', message: 'External database not configured' } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('DB Config:', {
      hostname: config.hostname,
      port: config.port,
      database: config.database,
      user: config.user,
      hasTls: !!config.tls
    });

    // Connect to external PostgreSQL database
    const client = new Client(config);

    try {
      console.log('Connecting to external database...');
      await client.connect();
      console.log('Connected successfully!');

      // Execute query with LIMIT 1
      const safeSql = sql.trim().replace(/;$/, '') + ' LIMIT 1';
      console.log('Executing query with LIMIT 1...');
      console.log('Safe SQL:', safeSql.substring(0, 200));
      
      const result = await client.queryObject(safeSql);
      console.log('Query executed. Rows returned:', result.rows?.length || 0);

      // Extract first value
      let value: number | null = null;
      if (result.rows && result.rows.length > 0) {
        const firstRow = result.rows[0] as Record<string, any>;
        console.log('First row keys:', Object.keys(firstRow));
        const firstValue = Object.values(firstRow)[0];
        console.log('First value:', firstValue, 'Type:', typeof firstValue);
        
        if (typeof firstValue === 'number') {
          value = firstValue;
        } else if (typeof firstValue === 'string' && !isNaN(parseFloat(firstValue))) {
          value = parseFloat(firstValue);
        } else if (firstValue === null) {
          value = null;
        } else {
          console.warn('Could not convert first value to number:', firstValue);
        }
      }

      console.log('Final value:', value);
      await client.end();
      console.log('Connection closed');

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
    console.error('=== Unexpected error in run-sql-tile ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: error.message } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
