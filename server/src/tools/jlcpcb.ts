import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const JLCPCB_API = 'https://jlcpcb.com/api/overseas-pcb-order/v1/shoppingCart/smtGood/selectSmtComponentList';

interface JlcComponent {
  componentCode: string;
  componentModelEn: string;
  componentBrandEn: string;
  componentLibraryType: string;
  componentTypeEn: string;
  componentSpecificationEn: string;
  stockCount: number;
  initialPrice: number;
  describe: string;
  dataManualUrl: string | null;
  lcscGoodsUrl: string | null;
  componentPrices: Array<{ startNumber: number; endNumber: number; productPrice: number }>;
  attributes: Array<{ attribute_name_en: string; attribute_value_name: string }>;
}

interface JlcResponse {
  code: number;
  data: {
    componentPageInfo: {
      total: number;
      list: JlcComponent[];
    };
  };
}

async function searchJlcpcb(body: Record<string, unknown>): Promise<JlcResponse> {
  const response = await fetch(JLCPCB_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`JLCPCB API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<JlcResponse>;
}

/** Attributes that are generic/noisy — skip these in compact output. */
const SKIP_ATTRS = new Set([
  'Operating Temperature',
  'Temperature Coefficient',
  'Mounting Type',
]);

/** Categories considered "passive" — get single-line compact output. */
const PASSIVE_CATEGORIES = new Set([
  'Chip Resistor - Surface Mount',
  'Multilayer Ceramic Capacitors MLCC - SMD/SMT',
  'Inductors (SMD)',
  'Ferrite Beads',
  'Fuses',
]);

function formatStock(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatComponent(c: JlcComponent): string {
  const tag = c.componentLibraryType === 'base' ? 'Basic' : 'Ext';
  const stock = formatStock(c.stockCount);
  const attrs = (c.attributes ?? [])
    .filter(a => !SKIP_ATTRS.has(a.attribute_name_en))
    .map(a => `${a.attribute_name_en}: ${a.attribute_value_name}`);

  if (PASSIVE_CATEGORIES.has(c.componentTypeEn)) {
    // Compact single-line for passives
    const keyAttrs = attrs.join(', ');
    return `${c.componentCode} | ${c.componentModelEn} | ${c.componentSpecificationEn} | ${tag} | $${c.initialPrice} | stock:${stock} | ${keyAttrs}`;
  }

  // Multi-line for ICs, modules, connectors, etc.
  const lines: string[] = [];
  lines.push(`${c.componentCode} | ${c.componentModelEn} (${c.componentBrandEn}) | ${c.componentSpecificationEn} | ${tag} | $${c.initialPrice} | stock:${stock}`);

  if (attrs.length > 0) {
    lines.push(`  ${attrs.join(', ')}`);
  }

  if (c.dataManualUrl) lines.push(`  Datasheet: ${c.dataManualUrl}`);

  return lines.join('\n');
}

function formatResults(data: JlcResponse): string {
  const info = data.data.componentPageInfo;
  const comps = info.list;

  if (comps.length === 0) {
    return 'No parts found matching your search.';
  }

  const header = `Found ${info.total.toLocaleString()} parts (showing ${comps.length}):\n`;
  const formatted = comps.map(formatComponent).join('\n');
  return header + formatted;
}

export function registerJlcpcbTools(server: McpServer): void {
  server.registerTool(
    'jlcpcb_search_parts',
    {
      description:
        'Search the JLCPCB component catalog by keyword. ' +
        'Returns LCSC part numbers, manufacturer, package, stock, price, and attributes. ' +
        'Use this to find components for your PCB design. ' +
        'This tool works without the EasyEDA extension connected.',
      inputSchema: {
        keyword: z.string().describe('Search keyword (e.g., "ESP32", "10k resistor 0402", "USB-C connector")'),
        libraryType: z.enum(['all', 'base', 'expand']).optional().default('all').describe(
          'Part type filter: "base" = JLCPCB basic parts (cheapest, most stock), ' +
          '"expand" = extended parts, "all" = both'
        ),
        limit: z.number().optional().default(10).describe('Maximum results to return (default: 10, max: 100)'),
      },
    },
    async ({ keyword, libraryType, limit }) => {
      try {
        const body: Record<string, unknown> = {
          keyword,
          pageSize: Math.min(limit ?? 10, 100),
          currentPage: 1,
        };
        if (libraryType && libraryType !== 'all') {
          body.componentLibraryType = libraryType;
        }

        const data = await searchJlcpcb(body);
        return {
          content: [{ type: 'text' as const, text: formatResults(data) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error searching JLCPCB: ${message}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'jlcpcb_search_resistors',
    {
      description:
        'Search JLCPCB for resistors. Combines your filters into an optimized search query. ' +
        'This tool works without the EasyEDA extension connected.',
      inputSchema: {
        resistance: z.string().optional().describe('Resistance value (e.g., "10k", "4.7k", "100")'),
        package: z.string().optional().describe('Package (e.g., "0402", "0603", "0805")'),
        tolerance: z.string().optional().describe('Tolerance (e.g., "1%", "5%")'),
        libraryType: z.enum(['all', 'base', 'expand']).optional().default('all').describe('Part type filter'),
        limit: z.number().optional().default(10).describe('Maximum results'),
      },
    },
    async ({ resistance, package: pkg, tolerance, libraryType, limit }) => {
      try {
        const parts = ['resistor'];
        if (resistance) parts.push(resistance);
        if (pkg) parts.push(pkg);
        if (tolerance) parts.push(tolerance);

        const body: Record<string, unknown> = {
          keyword: parts.join(' '),
          pageSize: Math.min(limit ?? 10, 100),
          currentPage: 1,
        };
        if (libraryType && libraryType !== 'all') {
          body.componentLibraryType = libraryType;
        }

        const data = await searchJlcpcb(body);
        return {
          content: [{ type: 'text' as const, text: formatResults(data) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'jlcpcb_search_capacitors',
    {
      description:
        'Search JLCPCB for capacitors. Combines your filters into an optimized search query. ' +
        'This tool works without the EasyEDA extension connected.',
      inputSchema: {
        capacitance: z.string().optional().describe('Capacitance value (e.g., "100nF", "10uF", "1pF")'),
        package: z.string().optional().describe('Package (e.g., "0402", "0603", "0805")'),
        voltage: z.string().optional().describe('Voltage rating (e.g., "25V", "50V")'),
        libraryType: z.enum(['all', 'base', 'expand']).optional().default('all').describe('Part type filter'),
        limit: z.number().optional().default(10).describe('Maximum results'),
      },
    },
    async ({ capacitance, package: pkg, voltage, libraryType, limit }) => {
      try {
        const parts = ['capacitor'];
        if (capacitance) parts.push(capacitance);
        if (pkg) parts.push(pkg);
        if (voltage) parts.push(voltage);

        const body: Record<string, unknown> = {
          keyword: parts.join(' '),
          pageSize: Math.min(limit ?? 10, 100),
          currentPage: 1,
        };
        if (libraryType && libraryType !== 'all') {
          body.componentLibraryType = libraryType;
        }

        const data = await searchJlcpcb(body);
        return {
          content: [{ type: 'text' as const, text: formatResults(data) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );
}
