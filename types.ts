
export interface User {
  id: string;
  email: string;
  name: string;
  password?: string;
  role: 'REPRESENTATIVE' | 'ADMIN';
  category?: string; // Ex: 'Salão de Beleza', 'Barbearia', 'Distribuidor', etc.
  cnpjs: string[]; // IDs dos CNPJs atribuídos a este usuário
  trayGroupId?: string; // Grupo padrão
}

export interface CNPJ {
  id: string;
  name: string;
  razao_social?: string;
  number: string;
  cpf_responsavel?: string;
  distributor: string;
  email_contato?: string;
  telefone?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  complemento?: string;
  trayGroupId: string; // Grupo que dita o catálogo (Basic, Premium, VIP)
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  image: string;
  category: string;
  trayCategoryId: string; // Crucial para o filtro de grupos Tray
  active: boolean;
}

export interface TrayCategory {
  id: string;
  name: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id: string;
  cnpjId: string;
  cnpjNumber: string;
  date: string;
  total: number;
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'CANCELLED';
  paymentLink?: string;
  items: CartItem[];
}

export interface NewsPost {
  id: string;
  title: string;
  content: string;
  date: string;
  imageUrl?: string;
}
