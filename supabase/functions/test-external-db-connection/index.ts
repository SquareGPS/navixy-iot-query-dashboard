import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
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
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ success: false, message: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client for auth verification
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !authUser) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin or editor role
    const { data: hasPermission, error: roleError } = await supabaseClient
      .rpc('is_admin_or_editor', { _user_id: authUser.id });

    if (roleError || !hasPermission) {
      console.error('Authorization failed - user does not have required role:', authUser.id);
      return new Response(
        JSON.stringify({ success: false, message: 'Insufficient permissions. Admin or editor role required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated and authorized:', authUser.id);

    const body = await req.json();
    const { url, host, port, database, user, password, ssl } = body;

    let config;
    
    if (url) {
      console.log('Testing connection with URL');
      config = parsePostgresUrl(url);
    } else {
      if (!host || !database || !user) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Host, database, and user are required' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('Testing connection with individual parameters');
      config = {
        user,
        password: password || '',
        database,
        hostname: host,
        port: port || 5432,
        tls: ssl ? { enabled: true, enforce: true } : { enabled: false },
      };
    }

    console.log('Connection config:', { 
      hostname: config.hostname, 
      port: config.port, 
      database: config.database, 
      user: config.user,
      tls: config.tls?.enabled ? 'enabled' : 'disabled'
    });

    const client = new Client(config);

    try {
      await client.connect();
      console.log('Successfully connected to external database');
      
      // Test a simple query
      await client.queryObject('SELECT 1 as test');
      console.log('Successfully executed test query');
      
      await client.end();

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Connection successful! Database is accessible.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (dbError: any) {
      console.error('Database connection error:', dbError);
      try {
        await client.end();
      } catch (e) {
        console.error('Error closing connection:', e);
      }
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Connection failed: ${dbError.message}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('Error in test-external-db-connection:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: `Error: ${error.message}` 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
