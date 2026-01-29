
import React, { useState, useEffect, useRef } from 'react';
import { User, CNPJ, Product, CartItem, Order } from './types';
import { 
  auth, db, onAuthStateChanged, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, signOut, collection, 
  onSnapshot, doc, setDoc, getDoc 
} from './services/firebase';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import News from './pages/News';
import Backoffice from './pages/Backoffice';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import CNPJSelector from './components/CNPJSelector';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCnpj, setSelectedCnpj] = useState<CNPJ | null>(null);
  const [currentPage, setCurrentPage] = useState<'catalog' | 'history' | 'news' | 'backoffice' | 'support'>('catalog');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCnpjModalOpen, setIsCnpjModalOpen] = useState(false);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [cnpjs, setCnpjs] = useState<CNPJ[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    // Escuta mudanças de autenticação
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const userRef = doc(db, 'users', fbUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            setUser({ id: fbUser.uid, ...userSnap.data() } as User);
          } else {
            // Se o usuário logou mas não tem doc (primeiro login social/espelho)
            const newUser: User = {
              id: fbUser.uid,
              email: fbUser.email || '',
              name: fbUser.displayName || 'Usuário',
              role: 'REPRESENTATIVE',
              cnpjs: []
            };
            await setDoc(userRef, newUser);
            setUser(newUser);
          }
        } catch (error) {
          console.error("Erro ao carregar dados do usuário:", error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listeners em tempo real para o banco de dados
    const unsubP = onSnapshot(collection(db, 'products'), (s) => 
      setProducts(s.docs.map(d => ({id: d.id, ...d.data()} as Product))));
    
    const unsubC = onSnapshot(collection(db, 'cnpjs'), (s) => 
      setCnpjs(s.docs.map(d => ({id: d.id, ...d.data()} as CNPJ))));
    
    const unsubO = onSnapshot(collection(db, 'orders'), (s) => 
      setOrders(s.docs.map(d => ({id: d.id, ...d.data()} as Order))));

    return () => { unsubP(); unsubC(); unsubO(); };
  }, [user]);

  const handleSupportAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || isAiLoading) return;

    const userMsg = aiInput;
    setAiInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAiLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const contents = [
        ...chatMessages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
        { role: 'user', parts: [{ text: userMsg }] }
      ];
      
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
        config: { systemInstruction: "Você é o suporte Niklaus B2B. Responda em Português, seja profissional e ajude com dúvidas de pedidos, prazos e faturamento." }
      });
      
      setChatMessages(prev => [...prev, { role: 'model', text: response.text || "Desculpe, não consegui processar sua dúvida agora." }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'model', text: "Erro ao conectar com a IA. Tente novamente em instantes." }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleLogin = async (email: string, pass?: string) => {
    await signInWithEmailAndPassword(auth, email, pass || '');
  };

  const handleRegister = async (name: string, category: string, email: string, pass?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass || '');
    const newUser: User = {
      id: cred.user.uid,
      email,
      name,
      category,
      role: 'REPRESENTATIVE',
      cnpjs: []
    };
    await setDoc(doc(db, 'users', newUser.id), newUser);
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
      <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-6"></div>
      <p className="font-black text-sm uppercase tracking-widest animate-pulse">Sincronizando Niklaus B2B</p>
    </div>
  );

  if (!user) return <Login onLogin={handleLogin} onRegister={handleRegister} />;

  const allowedCnpjs = cnpjs.filter(c => user.cnpjs.includes(c.id));
  
  if (!selectedCnpj || isCnpjModalOpen) {
    return (
      <CNPJSelector 
        cnpjs={user.role === 'ADMIN' ? cnpjs : allowedCnpjs} 
        onSelect={(c) => { setSelectedCnpj(c); setIsCnpjModalOpen(false); }} 
        currentSelection={selectedCnpj} 
      />
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} userRole={user.role} />
      <div className="flex-1 flex flex-col">
        <Navbar 
          user={user} 
          selectedCnpj={selectedCnpj} 
          onSwitchCnpj={() => setIsCnpjModalOpen(true)} 
          onLogout={() => signOut(auth)} 
          cartCount={cart.length} 
        />
        <main className="flex-1 overflow-y-auto p-8 animate-fade-in">
          {currentPage === 'catalog' && (
            <Dashboard 
              cnpj={selectedCnpj} products={products} cart={cart}
              onAddToCart={(p) => setCart(prev => [...prev, {...p, quantity: 1}])}
              onUpdateQuantity={(id, d) => setCart(prev => prev.map(i => i.id === id ? {...i, quantity: Math.max(1, i.quantity + d)} : i))}
              onRemoveFromCart={(id) => setCart(prev => prev.filter(i => i.id !== id))}
              onClearCart={() => setCart([])}
              onOrderCreated={(o) => setDoc(doc(db, 'orders', o.id), o)}
            />
          )}
          {currentPage === 'history' && <History user={user} orders={orders} cnpjs={cnpjs} />}
          {currentPage === 'news' && <News />}
          {currentPage === 'support' && (
             <div className="max-w-4xl mx-auto h-[calc(100vh-160px)] flex flex-col bg-white rounded-[3rem] shadow-xl overflow-hidden border">
                <div className="p-8 bg-slate-900 text-white flex items-center justify-between">
                  <h2 className="text-2xl font-black">Niklaus IA Support</h2>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                    <span className="text-[10px] font-black uppercase opacity-60">Online</span>
                  </div>
                </div>
                <div className="flex-1 p-8 overflow-y-auto space-y-4 scroll-smooth">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-20 opacity-30">
                      <p className="text-sm font-bold">Olá! Como posso ajudar com seus pedidos hoje?</p>
                    </div>
                  )}
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-5 rounded-[2rem] text-sm leading-relaxed ${m.role === 'user' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {isAiLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 p-4 rounded-full flex gap-1 animate-pulse">
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleSupportAi} className="p-8 bg-slate-50 border-t flex gap-3">
                  <input 
                    className="flex-1 bg-white border border-slate-200 p-5 rounded-2xl outline-none focus:border-emerald-500 transition-all font-medium" 
                    value={aiInput} 
                    onChange={e => setAiInput(e.target.value)} 
                    placeholder="Ex: Qual o prazo de entrega para Minas Gerais?" 
                  />
                  <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 rounded-2xl font-black transition-all active:scale-95 shadow-lg shadow-emerald-500/20">Enviar</button>
                </form>
             </div>
          )}
          {currentPage === 'backoffice' && user.role === 'ADMIN' && (
            <Backoffice 
              cnpjs={cnpjs} 
              products={products} 
              users={[]} 
              onUpsertCnpj={(c) => setDoc(doc(db, 'cnpjs', c.id), c)}
              onUpsertProduct={(p) => setDoc(doc(db, 'products', p.id), p)}
              onUpsertUser={()=>{}} 
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
