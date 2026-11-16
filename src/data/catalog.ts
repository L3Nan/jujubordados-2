export type ProductOption = {
  label: string;
  priceCents: number;
};

export type StoreProduct = {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  image: string;
  images?: string[];
  priceCents: number;
  priceLabel?: string;
  availability: string;
  productionDays?: number;
  sizes: ProductOption[];
  colors: string[];
  featured: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
  minimumOrderQuantity?: number;
  isActive?: boolean;
  availabilityNeedsReview?: boolean;
  sourceNote?: string;
};

export const categories = [
  "Maternidade acessórios",
  "Porta documentos",
  "Termocolantes",
] as const;

export const products: StoreProduct[] = [
  {
    id: "touquinha-rn-personalizada",
    name: "Touquinha RN Personalizada",
    category: "Maternidade acessórios",
    description:
      "🧸💕\nUm carinho especial para os primeiros dias de vida do seu bebê! Nossa touquinha RN é personalizada com o nome do pequeno ou da pequena, na cor de sua preferência.\n\nAlém de deixar o enxoval ainda mais lindo e exclusivo, é uma peça delicada para ajudar a manter a cabecinha do recém-nascido aquecida, conforme a orientação da equipe de saúde.\n\nFeita com carinho, especialmente para o seu bebê!\n\n🌼Prazo de produção: 7 dias úteis.",
    image: "/products/touquinha-rn.jpg",
    images: ["/products/touquinha-rn.jpg", "/products/touquinha-rn-2.jpg"],
    priceCents: 3890,
    availability: "Pronta entrega",
    productionDays: 7,
    sizes: [{ label: "RN", priceCents: 3890 }],
    colors: ["Branco"],
    featured: true,
    availabilityNeedsReview: true,
    sourceNote:
      "O catálogo público marca pronta entrega, mas a descrição também informa 7 dias úteis de produção. Confirmar com a loja antes de publicar como dado definitivo.",
  },
  {
    id: "bordado-adesivo-termocolante",
    name: "Bordado adesivo termocolante",
    category: "Termocolantes",
    description:
      "Personalize suas roupas e acessórios favoritos com muita praticidade. Este bordado adesivo termocolante é perfeito para dar vida nova às suas peças com rapidez e criatividade. Renove seu estilo de um jeito simples e cheio de charme.",
    image: "/products/termocolante.jpg",
    images: ["/products/termocolante.jpg"],
    priceCents: 2190,
    priceLabel: "A partir de",
    availability: "Sob encomenda",
    productionDays: 7,
    sizes: [
      { label: "10 cm", priceCents: 2190 },
      { label: "12 cm", priceCents: 2490 },
      { label: "15 cm", priceCents: 2790 },
    ],
    colors: ["Fundo preto", "Fundo vermelho"],
    featured: true,
    sourceNote:
      "O título original inclui o sufixo “(cópia)”; ele foi removido da apresentação da vitrine como provável resíduo de duplicação.",
  },
];

export const storeProfile = {
  name: "JUJUBORDADOS",
  tagline: "Cada ponto, um carinho. Cada bordado, uma história!",
  instagram: "https://instagram.com/jujubordados",
  tiktok: "https://tiktok.com/@jujubordados",
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
};

export const formatPrice = (priceCents: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(priceCents / 100);
