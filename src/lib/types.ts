export const FIXED_CATEGORIES = [
  'Aluguel',
  'Condomínio',
  'Energia',
  'Água',
  'Gás',
  'Internet',
  'Telefone',
  'Escola',
  'Plano de saúde',
  'Transporte',
  'Assinaturas',
  'Outro',
] as const

export const SPEND_CATEGORIES = [
  { id: 'mercado', label: 'Mercado' },
  { id: 'lazer', label: 'Lazer' },
  { id: 'combustivel', label: 'Combustível' },
  { id: 'moradia', label: 'Moradia' },
  { id: 'contas', label: 'Contas' },
  { id: 'saude', label: 'Saúde' },
  { id: 'transporte', label: 'Transporte' },
  { id: 'educacao', label: 'Educação' },
  { id: 'outro', label: 'Outro' },
] as const

export type SpendingCategory = (typeof SPEND_CATEGORIES)[number]['id']

export interface CustomCategory {
  id: string
  name: string
}

export type BudgetCategory = 'mercado' | 'lazer' | 'combustivel'

export type PaymentMethod = 'pix' | 'debito' | 'dinheiro'

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'pix', label: 'Pix' },
  { id: 'debito', label: 'Débito' },
  { id: 'dinheiro', label: 'Dinheiro' },
]

export const CARD_COLORS = [
  { id: 'forest', label: 'Verde', from: '#1f6b4a', to: '#0e3b2c' },
  { id: 'ink', label: 'Tinta', from: '#243044', to: '#121820' },
  { id: 'wine', label: 'Vinho', from: '#7a3044', to: '#3d1824' },
  { id: 'ocean', label: 'Azul', from: '#1e4d7b', to: '#10283f' },
  { id: 'copper', label: 'Cobre', from: '#8a5a2a', to: '#3f2914' },
  { id: 'plum', label: 'Ameixa', from: '#5c3d73', to: '#2c1c38' },
] as const

export type CardColorId = (typeof CARD_COLORS)[number]['id']

export const FIXED_ICONS = [
  { id: 'casa', label: 'Casa' },
  { id: 'predio', label: 'Prédio' },
  { id: 'raio', label: 'Energia' },
  { id: 'gota', label: 'Água' },
  { id: 'chama', label: 'Gás' },
  { id: 'wifi', label: 'Internet' },
  { id: 'telefone', label: 'Telefone' },
  { id: 'escola', label: 'Escola' },
  { id: 'saude', label: 'Saúde' },
  { id: 'carro', label: 'Transporte' },
  { id: 'assinatura', label: 'Assinatura' },
  { id: 'outro', label: 'Outro' },
] as const

export type FixedIconId = (typeof FIXED_ICONS)[number]['id']

const CATEGORY_ICONS: Record<string, FixedIconId> = {
  Aluguel: 'casa',
  Condomínio: 'predio',
  Energia: 'raio',
  Água: 'gota',
  Gás: 'chama',
  Internet: 'wifi',
  Telefone: 'telefone',
  Escola: 'escola',
  'Plano de saúde': 'saude',
  Transporte: 'carro',
  Assinaturas: 'assinatura',
  Outro: 'outro',
}

export function iconForCategory(category: string): FixedIconId {
  return CATEGORY_ICONS[category] ?? 'outro'
}

export interface FixedExpense {
  id: string
  name: string
  amount: number
  dueDay: number
  category: string
  icon: FixedIconId
  notes: string
  active: boolean
}

export interface CreditCard {
  id: string
  nickname: string
  lastFour: string
  limit: number
  closingDay: number
  dueDay: number
  color: CardColorId
}

export interface Purchase {
  id: string
  cardId: string
  description: string
  amount: number
  installments: number
  date: string
  category: string
}

export interface CashExpense {
  id: string
  description: string
  amount: number
  date: string
  category: BudgetCategory
  method: PaymentMethod
  inflowId: string | null
}

export interface Goals {
  leisureWeeklyMax: number | null
  groceryMonthlyDefault: number | null
  groceryByMonth: Record<string, number>
  fuelMonthlyDefault: number | null
  fuelByMonth: Record<string, number>
}

export interface GroceryInflow {
  id: string
  name: string
  amount: number
  month: string
  repeat: 'monthly' | 'once'
}

export const PEOPLE = [
  { id: 'sara', label: 'Sara' },
  { id: 'vinicius', label: 'Vinicius' },
] as const

export type Person = (typeof PEOPLE)[number]['id']

export type IncomeRepeat = 'monthly' | 'once'

export interface IncomeSource {
  id: string
  person: Person
  name: string
  amount: number
  date: string | null
  repeat: IncomeRepeat
}

export const COMPANY_CATEGORIES = ['Venda', 'Serviço', 'Pró-labore', 'Fornecedor', 'Imposto', 'Outro'] as const

export type CompanyDirection = 'entrada' | 'saida'

export type CompanyPayment = 'pix' | 'debito' | 'dinheiro' | 'cartao'

export const COMPANY_PAYMENTS: { id: CompanyPayment; label: string }[] = [
  { id: 'pix', label: 'Pix' },
  { id: 'debito', label: 'Débito' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'cartao', label: 'Cartão de crédito' },
]

export interface CompanyEntry {
  id: string
  direction: CompanyDirection
  description: string
  amount: number
  date: string
  category: string
  method: CompanyPayment
  cardId: string | null
  installments: number
  purchaseId: string | null
}

export interface AppState {
  version: 1
  incomes: IncomeSource[]
  companyEntries: CompanyEntry[]
  fixedExpenses: FixedExpense[]
  cards: CreditCard[]
  purchases: Purchase[]
  cashExpenses: CashExpense[]
  paidFixed: Record<string, true>
  paidInvoices: Record<string, true>
  goals: Goals
  groceryInflows: GroceryInflow[]
  customCategories: CustomCategory[]
}

export interface SpendEntry {
  id: string
  source: 'card' | 'cash'
  description: string
  amount: number
  date: string
  category: BudgetCategory
  detail: string
  cardId?: string
  installment?: number
}

export function emptyState(): AppState {
  return {
    version: 1,
    incomes: [],
    companyEntries: [],
    fixedExpenses: [],
    cards: [],
    purchases: [],
    cashExpenses: [],
    paidFixed: {},
    paidInvoices: {},
    goals: {
      leisureWeeklyMax: null,
      groceryMonthlyDefault: null,
      groceryByMonth: {},
      fuelMonthlyDefault: null,
      fuelByMonth: {},
    },
    groceryInflows: [],
    customCategories: [],
  }
}

export function categoryLabel(id: string, custom: CustomCategory[] = []): string {
  return SPEND_CATEGORIES.find((item) => item.id === id)?.label ?? custom.find((item) => item.id === id)?.name ?? id
}

export function cardPalette(id: string) {
  return CARD_COLORS.find((item) => item.id === id) ?? CARD_COLORS[0]
}

export function methodLabel(method: PaymentMethod): string {
  return PAYMENT_METHODS.find((item) => item.id === method)?.label ?? method
}

export function personLabel(person: Person): string {
  return PEOPLE.find((item) => item.id === person)?.label ?? person
}
