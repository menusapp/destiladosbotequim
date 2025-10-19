import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

interface UserRole {
  role: string;
  restaurant_id: string | null;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRoles(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRoles(session.user.id);
      } else {
        setRoles([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, restaurant_id")
        .eq("user_id", userId);

      if (error) throw error;
      setRoles(data || []);
    } catch (error) {
      console.error("Error fetching user roles:", error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const hasRole = (role: string): boolean => {
    return roles.some((r) => r.role === role);
  };

  const getRestaurantId = (): string | null => {
    const adminRole = roles.find((r) => r.role === "restaurant_admin");
    return adminRole?.restaurant_id || null;
  };

  return {
    user,
    session,
    roles,
    loading,
    signOut,
    hasRole,
    getRestaurantId,
    isCEO: hasRole("ceo"),
    isRestaurantAdmin: hasRole("restaurant_admin"),
  };
};
