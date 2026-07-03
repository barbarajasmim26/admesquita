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
    id: "gabriel",
    label: "Rua Gabriel Gomes",
    propertyNameMatch: "gabriel gomes",
    defaultAddress: "Rua Gabriel Gomes, Cascavel/CE",
    forumCity: "Cascavel",
  },
  {
    id: "julia",
    label: "Rua Júlia de Melo",
    propertyNameMatch: "julia de melo",
    defaultAddress: "Rua Júlia de Melo, Cascavel/CE",
    forumCity: "Cascavel",
  },
  {
    id: "luciano",
    label: "Rua Luciano Rodrigues",
    propertyNameMatch: "luciano rodrigues",
    defaultAddress: "Rua Luciano Rodrigues, Cascavel/CE",
    forumCity: "Cascavel",
  },
  {
    id: "sigefredo",
    label: "Rua Sigefredo Bessa",
    propertyNameMatch: "sigefredo bessa",
    defaultAddress: "Rua Sigefredo Bessa, Cascavel/CE",
    forumCity: "Cascavel",
  },
  {
    id: "joaquim-edson",
    label: "Rua Joaquim Cartaxo com Rodovia Edson Queiroz",
    propertyNameMatch: "joaquim cartaxo",
    defaultAddress: "Rua Joaquim Cartaxo com Rodovia Edson Queiroz, Cascavel/CE",
    forumCity: "Cascavel",
  },
  {
    id: "manual",
    label: "Endereço manual (digitar abaixo)",
    propertyNameMatch: "__manual__",
    defaultAddress: "",
    forumCity: "Cascavel",
  },
];

export function findTemplateForProperty(propertyName?: string | null): ContractTemplate | undefined {
  if (!propertyName) return undefined;
  const n = propertyName.toLowerCase();
  return CONTRACT_TEMPLATES.find((t) => n.includes(t.propertyNameMatch));
}
