import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { host, port, database, user, password } = await req.json();

    if (!host || !database || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Host, database, and user are required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Testing connection to:', { host, port: port || 5432, database, user });

    const client = new Client({
      user,
      password: password || '',
      database,
      hostname: host,
      port: port || 5432,
    });

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
