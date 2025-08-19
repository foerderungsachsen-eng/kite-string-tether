import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const History = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ausführungshistorie</h1>
          <p className="text-muted-foreground">Übersicht über alle Webhook-Ausführungen</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Historie</CardTitle>
            <CardDescription>
              Hier werden alle Ihre Webhook-Ausführungen angezeigt
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

export default History;