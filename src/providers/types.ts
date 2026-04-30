import type { AgentHubConfig, McpConfig, TargetDefinition, WriteMode } from "../config/schema.js";

export type ProviderDetectionResult = {
  installed: boolean;
  notes?: string[];
};

export type ProviderTargetContext = {
  config: AgentHubConfig;
  workspaceRoot?: string;
  defaultWriteMode: WriteMode;
};

export type SourceSection = {
  title: string;
  path: string;
  content: string;
  kind: "memory" | "skill" | "other";
};

export type RenderContext = {
  config: AgentHubConfig;
  target: TargetDefinition;
  generatedAt: string;
  sourceRoot: string;
  sections: SourceSection[];
};

export type McpRenderContext = RenderContext & {
  mcp: McpConfig;
};

export type RenderedFile = {
  path: string;
  content: string;
  writeMode: WriteMode;
  format?: "text" | "json" | "toml";
  managedKeys?: string[];
};

export interface ProviderAdapter {
  id: string;
  displayName: string;
  detect(): Promise<ProviderDetectionResult>;
  getDefaultTargets(context: ProviderTargetContext): Promise<TargetDefinition[]>;
  renderInstructions(context: RenderContext): Promise<RenderedFile[]>;
  renderSkills?(context: RenderContext): Promise<RenderedFile[]>;
  renderMcp?(context: McpRenderContext): Promise<RenderedFile[]>;
}
