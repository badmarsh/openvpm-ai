"use client";

import React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Pencil,
  Copy,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SECTION_COMPONENTS } from "./website-sections";
import { useI18n } from "@/lib/i18n";
import type {
  WebsiteSection,
  BrandKitData,
  WebsitePublicData,
} from "@/lib/marketing/website-builder-types";
import { SECTION_TEMPLATES } from "./website-editor-palette";
import { cn } from "@/lib/utils";

interface SortableSectionCardProps {
  section: WebsiteSection;
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  onEdit: (section: WebsiteSection) => void;
  onDuplicate: (sectionId: string) => void;
  onToggleVisibility: (sectionId: string) => void;
  onDelete: (sectionId: string) => void;
}

function SortableSectionCard({
  // component
  section,
  brandKit,
  contextData,
  onEdit,
  onDuplicate,
  onToggleVisibility,
  onDelete,
}: SortableSectionCardProps) {
  const { t } = useI18n();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const Component = SECTION_COMPONENTS[section.type];
  const templateDef = SECTION_TEMPLATES.find((t) => t.type === section.type);
  const sectionName = templateDef?.name || section.type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-2xl border transition-all duration-200 bg-background shadow-xs overflow-hidden",
        isDragging
          ? "border-primary shadow-2xl opacity-90 scale-[1.01] ring-2 ring-primary/30"
          : "border-border/80 hover:border-primary/60",
        !section.visible && "opacity-60 bg-muted/20"
      )}
    >
      {/* Section Header Toolbar & Drag Handle */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/60 border-b border-border/80">
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background cursor-grab active:cursor-grabbing transition-colors text-xs font-semibold select-none border border-transparent hover:border-border"
            title={t("marketing.website.moveSectionTooltip", "Kliknite a potiahnite pre presun sekcie")}
          >
            <GripVertical className="h-4 w-4 text-primary" />
            <span>{t("marketing.website.moveSection", "Presunúť")}</span>
          </div>

          <Badge variant="outline" className="text-xs font-bold bg-background text-foreground">
            {sectionName}
          </Badge>

          {!section.visible && (
            <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[11px]">
              <EyeOff className="h-3 w-3" />
              {t("marketing.website.hiddenSection", "Skrytá sekcia")}
            </Badge>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(section)}
            className="h-7 gap-1 text-xs text-foreground hover:text-primary hover:bg-primary/10"
          >
            <Pencil className="h-3.5 w-3.5 text-primary" />
            {t("common.edit", "Upraviť")}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDuplicate(section.id)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
            title={t("marketing.website.duplicateSectionTooltip", "Duplikovať sekciu")}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => onToggleVisibility(section.id)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
            title={section.visible ? t("marketing.website.hideSection", "Skryť sekciu") : t("marketing.website.showSection", "Zobraziť sekciu")}
          >
            {section.visible ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5 text-amber-500" />
            )}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(section.id)}
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title={t("marketing.website.deleteSectionTooltip", "Odstrániť sekciu")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Live Preview Render */}
      <div className="select-none pointer-events-none">
        {Component && (
          <Component
            content={section.content}
            brandKit={brandKit}
            contextData={contextData}
            isEditor
          />
        )}
      </div>
    </div>
  );
}

interface WebsiteEditorCanvasProps {
  sections: WebsiteSection[];
  brandKit?: BrandKitData;
  contextData?: WebsitePublicData;
  onReorder: (sections: WebsiteSection[]) => void;
  onEditSection: (section: WebsiteSection) => void;
  onDuplicateSection: (sectionId: string) => void;
  onToggleVisibility: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
}

export function WebsiteEditorCanvas({
  sections,
  brandKit,
  contextData,
  onReorder,
  onEditSection,
  onDuplicateSection,
  onToggleVisibility,
  onDeleteSection,
}: WebsiteEditorCanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const updated = [...sections];
      const [removed] = updated.splice(oldIndex, 1);
      updated.splice(newIndex, 0, removed);
      // Re-index orders
      const reindexed = updated.map((s, idx) => ({ ...s, order: idx }));
      onReorder(reindexed);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sections.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-6 w-full">
          {sections.map((section) => (
            <SortableSectionCard
              key={section.id}
              section={section}
              brandKit={brandKit}
              contextData={contextData}
              onEdit={onEditSection}
              onDuplicate={onDuplicateSection}
              onToggleVisibility={onToggleVisibility}
              onDelete={onDeleteSection}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
