import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kdpqimetajnhcqseajok.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcHFpbWV0YWpuaGNxc2Vham9rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDAwNDExMCwiZXhwIjoyMDY5NTgwMTEwfQ.SJA7epWpQydPi7OaTEYM4N0im7q6cz9elOYUZ9PWvPw';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createTestAdmin() {
  try {
    console.log('Creating test admin user: test@admin.com');

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'test@admin.com',
      password: 'Pass123',
      email_confirm: true,
      user_metadata: {
        first_name: 'Test',
        last_name: 'Admin',
      },
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return;
    }

    console.log('✅ Auth user created:', authData.user?.id);

    const userId = authData.user?.id;
    if (!userId) {
      console.error('No user ID returned');
      return;
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: 'test@admin.com',
        first_name: 'Test',
        last_name: 'Admin',
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
    } else {
      console.log('✅ Profile created');
    }

    // Assign Admin role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role: 'Admin',
      });

    if (roleError) {
      console.error('Error assigning role:', roleError);
    } else {
      console.log('✅ Admin role assigned');
    }

    console.log('\n✅ SUCCESS! Admin user created:');
    console.log('   Email: test@admin.com');
    console.log('   Password: Pass123');
    console.log('   Role: Admin');
    console.log('\nYou can now log in at: /auth');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createTestAdmin();
