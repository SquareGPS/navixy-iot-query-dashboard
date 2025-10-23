import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sql } = await req.json();

    if (!sql || typeof sql !== 'string') {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'SQL query is required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate SQL (only SELECT, no multiple statements)
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

    // Block dangerous keywords
    const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE'];
    if (dangerousKeywords.some(keyword => trimmedSql.includes(keyword))) {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_SQL', message: 'Query contains prohibited keywords' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Execute query with LIMIT 1
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const safeSql = sql.trim().replace(/;$/, '') + ' LIMIT 1';
    
    const { data, error } = await supabase.rpc('execute_sql', { query: safeSql });

    if (error) {
      console.error('SQL execution error:', error);
      return new Response(
        JSON.stringify({ error: { code: 'EXECUTION_ERROR', message: error.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract first value
    let value: number | null = null;
    if (data && Array.isArray(data) && data.length > 0) {
      const firstRow = data[0];
      const firstValue = Object.values(firstRow)[0];
      
      if (typeof firstValue === 'number') {
        value = firstValue;
      } else if (typeof firstValue === 'string' && !isNaN(parseFloat(firstValue))) {
        value = parseFloat(firstValue);
      }
    }

    return new Response(
      JSON.stringify({ value }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in run-sql-tile:', error);
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: error.message } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
