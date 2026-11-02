export interface MigrationConfig {
  /** Path to the Notion export zip file */
  inputZip: string;

  /** Path to the output Obsidian vault directory */
  outputDir: string;

  /** Overwrite existing files in output directory */
  force: boolean;

  /** Run full pipeline but skip writing vault files */
  dryRun: boolean;

  /** Enable debug-level logging to stderr */
  verbose: boolean;
}

export const DEFAULT_CONFIG: Partial<MigrationConfig> = {
  force: false,
  dryRun: false,
  verbose: false,
};
