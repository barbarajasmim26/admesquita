export interface ContractTemplate {
  id: string;
  label: string;
  propertyNameMatch: string; // matches property.name (lowercase contains)
  defaultAddress: string;
  forumCity?: string;
  notes?: string;
}

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: "damiao",
    label: "Condomínio Damião Coco",
    propertyNameMatch: "damião coco",
    defaultAddress: "Rua Damião Coco, Cascavel/CE",
    forumCity: "Cascavel",
  },
  {
    id: "gabriel",
    label: "Condomínio Gabriel Gomes — Bessalândia",
    propertyNameMatch: "gabriel gomes",
    defaultAddress: "Rua Gabriel Gomes Barbosa, Bessalândia, Cascavel/CE",
    forumCity: "Cascavel",
  },
  {
    id: "julia",
    label: "Condomínio Julia de Melo — Bessalândia",
    propertyNameMatch: "julia de melo",
    defaultAddress: "Rua Prof. Júlia de Melo, Bessalândia, Cascavel/CE",
    forumCity: "Cascavel",
  },
  {
    id: "luciano",
    label: "Condomínio Luciano Rodrigues — Rio Novo",
    propertyNameMatch: "luciano rodrigues",
    defaultAddress: "Rua Luciano Rodrigues, Rio Novo, Cascavel/CE",
    forumCity: "Cascavel",
  },
  {
    id: "sigefredo",
    label: "Condomínio Sigefredo Bessa — Bessalândia",
    propertyNameMatch: "sigefredo bessa",
    defaultAddress: "Rua Sigefredo Bessa, Bessalândia, Cascavel/CE",
    forumCity: "Cascavel",
  },
  {
    id: "joaquim",
    label: "Joaquim Cartaxo — Luciano Rodrigues",
    propertyNameMatch: "joaquim cartaxo",
    defaultAddress: "Rua Luciano Rodrigues, Rio Novo, Cascavel/CE",
    forumCity: "Cascavel",
    notes: "Imóvel localizado na Rua Luciano Rodrigues — endereço Joaquim Cartaxo",
  },
];

export function findTemplateForProperty(propertyName?: string | null): ContractTemplate | undefined {
  if (!propertyName) return undefined;
  const n = propertyName.toLowerCase();
  return CONTRACT_TEMPLATES.find((t) => n.includes(t.propertyNameMatch));
}