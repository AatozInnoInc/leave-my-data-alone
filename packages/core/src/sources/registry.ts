// Source registry for external prompt repositories.

export type SourceTier = 'tier1' | 'tier2' | 'tier3';

export interface SourceDescriptor {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly homepage: string;
  readonly tier: SourceTier;
  readonly license?: string;
}

export interface SourceRegistry {
  list(): readonly SourceDescriptor[];
  getById(id: string): SourceDescriptor | undefined;
}

const DEFAULT_SOURCES: readonly SourceDescriptor[] = [
  {
    id: 'jailbreakbench',
    name: 'JailbreakBench',
    description: 'Structured jailbreak and prompt injection test cases.',
    homepage: 'https://github.com/JailbreakBench/JailbreakBench',
    tier: 'tier1',
  },
  {
    id: 'awesome-jailbreak',
    name: 'Awesome Jailbreak on LLMs',
    description: 'Academic jailbreak references and datasets.',
    homepage: 'https://github.com/yueliu1999/Awesome-Jailbreak-on-LLMs',
    tier: 'tier1',
  },
  {
    id: `jailbreak_llms`,
    name: `In-The-Wild Jailbreak Prompts on LLMs`,
    description: `Academic jailbreak references and datasets.`,
    homepage: `https://github.com/yueliu1999/Awesome-Jailbreak-on-LLMs`,
    tier: 'tier1',
  },
];

/**
 * Creates a source registry with default Tier 1 sources.
 */
export const createSourceRegistry = (
  sources: readonly SourceDescriptor[] = DEFAULT_SOURCES,
): SourceRegistry => ({
  list: () => [...sources],
  getById: (id: string) => sources.find((entry) => entry.id === id),
});
