import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { User, Session } from '@supabase/supabase-js';

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          navigate('/');
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignIn = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      toast({
        title: "Anmeldung fehlgeschlagen",
        description: error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const handleSignUp = async (email: string, password: string) => {
    setLoading(true);
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          email_confirm: false
        }
      }
    });
    
    if (error) {
      toast({
        title: "Registrierung fehlgeschlagen",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Registrierung erfolgreich",
        description: "Konto wurde erfolgreich erstellt. Sie können sich jetzt anmelden.",
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Webhook Dashboard</CardTitle>
          <CardDescription>Melden Sie sich an oder erstellen Sie ein Konto</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Anmelden</TabsTrigger>
              <TabsTrigger value="signup">Registrieren</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <AuthForm onSubmit={handleSignIn} loading={loading} type="signin" />
            </TabsContent>
            
            <TabsContent value="signup">
              <AuthForm onSubmit={handleSignUp} loading={loading} type="signup" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

interface AuthFormProps {
  onSubmit: (email: string, password: string) => void;
  loading: boolean;
  type: "signin" | "signup";
}

const AuthForm = ({ onSubmit, loading, type }: AuthFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email, password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="password">Passwort</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Ihr Passwort"
          required
        />
      </div>
      
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Lädt..." : type === "signin" ? "Anmelden" : "Registrieren"}
      </Button>
    </form>
  );
};

export default Auth;