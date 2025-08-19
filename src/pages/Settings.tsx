import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Settings = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Einstellungen</h1>
          <p className="text-muted-foreground">Verwalten Sie Ihre Kontoeinstellungen</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Kontoeinstellungen</CardTitle>
            <CardDescription>
              Hier können Sie Ihre persönlichen Einstellungen verwalten
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Wird bald implementiert...</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Settings;