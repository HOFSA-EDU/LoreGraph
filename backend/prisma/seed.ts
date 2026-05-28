import { PrismaClient } from '@prisma/client';
import { MockAnalyzer } from '../src/analyzers/MockAnalyzer';
import { persistAnalyzerResult } from '../src/services/persistAnalyzerResult';

const prisma = new PrismaClient();

const SAMPLE_TEXT = `Die Stadt Graufurt wird vom Orden der Silbernen Maske kontrolliert. Hauptmann Elric vertraut der Abenteurergruppe, verschweigt ihnen aber, dass seine Schwester Mara für den Kult der Asche arbeitet. Der Kult sucht den Splitter von Veyra, ein Artefakt, das unter der alten Brücke verborgen liegt. Mara hasst Elric, weil er sie einst verraten hat. Die Diebesgilde von Graufurt schuldet der Gruppe noch einen Gefallen.`;

async function main() {
  // Idempotent seed: skip if a campaign with this name already exists.
  const existing = await prisma.campaign.findFirst({
    where: { name: 'Graufurt – Beispielkampagne' },
  });
  if (existing) {
    console.log('[seed] Beispielkampagne existiert bereits, überspringe.');
    return;
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: 'Graufurt – Beispielkampagne',
      system: 'Generic Fantasy',
      tone: 'Düster, Mystery',
      description:
        'Eine Beispielkampagne in der Stadt Graufurt, die den Workflow demonstriert.',
    },
  });

  await prisma.campaignSourceText.create({
    data: {
      campaignId: campaign.id,
      title: 'Lore: Graufurt',
      sourceType: 'lore',
      rawText: SAMPLE_TEXT,
    },
  });

  const analyzer = new MockAnalyzer();
  const result = await analyzer.analyze({
    text: SAMPLE_TEXT,
    sourceType: 'lore',
  });

  await persistAnalyzerResult(prisma, campaign.id, result);
  console.log(`[seed] Beispielkampagne erstellt: ${campaign.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
