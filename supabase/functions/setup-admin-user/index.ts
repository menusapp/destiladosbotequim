import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const email = "menusappoficial@gmail.com";
  const password = "menusapp123@";

  // Try to create user
  const { data: createData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  let userId: string;

  if (createError) {
    // User might already exist, try to find them
    const { data: listData } = await supabase.auth.admin.listUsers();
    const existing = listData?.users?.find((u: any) => u.email === email);
    if (!existing) {
      return new Response(JSON.stringify({ error: createError.message }), { status: 400 });
    }
    userId = existing.id;
    // Update password
    await supabase.auth.admin.updateUserById(userId, { password });
  } else {
    userId = createData.user.id;
  }

  // Assign both ceo and dev roles
  for (const role of ["ceo", "dev"]) {
    const { error } = await supabase.from("user_roles").upsert(
      { user_id: userId, role },
      { onConflict: "user_id,role" }
    );
    if (error) console.error(`Error assigning ${role}:`, error);
  }

  return new Response(JSON.stringify({ success: true, userId, message: "User created with ceo + dev roles" }), {
    headers: { "Content-Type": "application/json" },
  });
});
