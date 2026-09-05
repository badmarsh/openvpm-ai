"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, OctagonX, AlertTriangle, Calendar, Plus, Filter } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ContentPlanPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newChannel, setNewChannel] = useState("instagram");
  const [newDate, setNewDate] = useState("");

  const utils = trpc.useUtils();
  const listQuery = trpc.extensions.marketing.listContentItems.useQuery({
    status: status === "all" ? undefined : (status as any),
    channel: channel === "all" ? undefined : (channel as any),
  });

  const validateMutation = trpc.extensions.marketing.validateContent.useMutation();
  const createMutation = trpc.extensions.marketing.createContentItem.useMutation({
    onSuccess: () => {
      setIsDialogOpen(false);
      utils.extensions.marketing.listContentItems.invalidate();
      setNewTitle("");
      setNewBody("");
      setNewDate("");
    },
  });
  const approveMutation = trpc.extensions.marketing.approveContentItem.useMutation({
    onSuccess: () => {
      utils.extensions.marketing.listContentItems.invalidate();
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newBody.trim().length > 0) {
        validateMutation.mutate({ text: newBody, context: 'marketing' });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [newBody, newChannel]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("marketing.plan.title", "Plán obsahu")}</h1>
          <p className="text-muted-foreground">
            {t("marketing.plan.description", "Schvaľujte príspevky pre sociálne siete. Schválenie týždenného plánu trvá menej ako 5 minút.")}
          </p>
        </div>
        
        {!isDialogOpen && (
          <div onClick={() => setIsDialogOpen(true)}>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t("marketing.plan.newPost", "Nový príspevok")}
            </Button>
          </div>
        )}
        {isDialogOpen && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <div className="fixed z-50 grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg">
              <div className="flex flex-col space-y-1.5 text-center sm:text-left">
                <h2 className="text-lg font-semibold leading-none tracking-tight">{t("marketing.plan.newPost", "Nový príspevok")}</h2>
              </div>
              
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Channel</label>
                <select value={newChannel} onChange={(e) => setNewChannel(e.target.value)} className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="google_business">Google Business</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Scheduled For</label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Body</label>
                <Textarea rows={4} value={newBody} onChange={(e) => setNewBody(e.target.value)} />
                {validateMutation.data?.findings && validateMutation.data.findings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {validateMutation.data.findings.map((f: any, i: number) => (
                      <p key={i} className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {f.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <Button 
                className="w-full" 
                onClick={() => createMutation.mutate({ title: newTitle, body: newBody, channel: newChannel as any, scheduledFor: newDate })}
                disabled={!newTitle || !newBody || !newDate || createMutation.isPending}
              >
                Create
              </Button>
            </div>
          
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Close</Button>
            </div>
          </div>
        )}

      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="all">{t("marketing.plan.all", "All")}</TabsTrigger>
            <TabsTrigger value="proposed">{t("marketing.plan.proposed", "Proposed")}</TabsTrigger>
            <TabsTrigger value="approved">{t("marketing.plan.approved", "Approved")}</TabsTrigger>
            <TabsTrigger value="published">{t("marketing.plan.published", "Published")}</TabsTrigger>
            <TabsTrigger value="blocked">{t("marketing.plan.blocked", "Blocked")}</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className="flex h-10 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <option value="all">All Channels</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="google_business">Google Business</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>
      </div>

      {listQuery.isLoading ? (
        <div className="space-y-4">
          <div className="h-24 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-24 w-full animate-pulse rounded-md bg-muted" />
        </div>
      ) : listQuery.data?.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t("marketing.plan.noItems", "Žiadne príspevky. Vytvorte prvý príspevok.")}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listQuery.data?.map((item: any) => (
            <div key={item.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-sm line-clamp-2">{item.title}</h3>
                <Badge variant="outline">{item.channel}</Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{item.scheduledFor ? new Date(item.scheduledFor).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    item.status === 'proposed' ? 'secondary' :
                    item.status === 'approved' ? 'default' :
                    item.status === 'published' ? 'default' :
                    item.status === 'blocked' ? 'destructive' : 'outline'
                  }
                  className={item.status === 'approved' || item.status === 'published' ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  {item.status}
                </Badge>
                
                {item.validatorVerdict && (
                  <Badge
                    variant={
                      item.validatorVerdict === 'pass' ? 'outline' :
                      item.validatorVerdict === 'warn' ? 'secondary' :
                      'destructive'
                    }
                    className={item.validatorVerdict === 'warn' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : ''}
                  >
                    {item.validatorVerdict === 'pass' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                    {item.validatorVerdict === 'warn' && <AlertTriangle className="mr-1 h-3 w-3" />}
                    {item.validatorVerdict === 'block' && <OctagonX className="mr-1 h-3 w-3" />}
                    {item.validatorVerdict}
                  </Badge>
                )}
              </div>
              
              {item.status === 'blocked' && item.validatorFindings && item.validatorFindings.length > 0 && (
                <div className="text-xs text-destructive bg-destructive/10 p-2 rounded-md">
                  {item.validatorFindings.map((f: any, i: number) => (
                    <div key={i} className="mb-1 last:mb-0">• {f.message}</div>
                  ))}
                </div>
              )}

              {item.status === 'proposed' && (
                <Button 
                  className="w-full mt-2" 
                  size="sm" 
                  onClick={() => approveMutation.mutate({ id: item.id })}
                  disabled={approveMutation.isPending}
                >
                  {t("marketing.plan.approve", "Approve")}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

