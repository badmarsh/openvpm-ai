"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageLogsView } from "@/components/communications/message-logs-view";
import { InboxView } from "@/components/communications/inbox-view";
import { Inbox as InboxIcon, MessageSquare, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <InboxContent />
    </Suspense>
  );
}

function InboxContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "logs" ? "logs" : "inbox";
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Tabs directly at the top */}
      <div className="mb-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="inbox" className="gap-1.5">
              <InboxIcon className="h-3.5 w-3.5" />
              {t("inbox.tabInbox", "Schránka")}
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              {t("inbox.tabLogs", "Správy & Logy")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === "logs" ? (
        <div className="flex-1 overflow-y-auto min-h-0">
          <MessageLogsView />
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <InboxView />
        </div>
      )}
    </div>
  );
}
