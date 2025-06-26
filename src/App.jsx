import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

// --- Safe Firebase Initialization ---
let app, db, auth, firebaseInitializationError = null;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (error) {
    console.error("Firebase initialization failed:", error);
    firebaseInitializationError = "Could not initialize Firebase. Please check your environment variables.";
}

const appId = "greenhouse-gang-nursery";

// --- Contexts ---
const CartContext = createContext();
const PageContext = createContext();

const CartProvider = ({ children }) => {
    const [cartItems, setCartItems] = useState([]);
    const addToCart = (product) => {
        setCartItems(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };
    const removeFromCart = (productId) => setCartItems(prev => prev.filter(item => item.id !== productId));
    const updateQuantity = (productId, newQuantity) => {
        if (newQuantity < 1) {
            removeFromCart(productId);
            return;
        }
        setCartItems(prev => prev.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item));
    };
    const clearCart = () => setCartItems([]);
    const cartTotal = cartItems.reduce((total, item) => total + (item.price || 0) * item.quantity, 0);
    return <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal }}>{children}</CartContext.Provider>;
};

// --- Main App Component ---
function App() {
    const [currentPage, setCurrentPage] = useState('home');
    const [plants, setPlants] = useState([]);
    const [faqs, setFaqs] = useState([]);
    const [isReady, setIsReady] = useState(false);
    const [appError, setAppError] = useState(firebaseInitializationError);

    useEffect(() => {
        if (appError) return;
        return onAuthStateChanged(auth, user => {
            if (user) {
                setIsReady(true);
            } else {
                signInAnonymously(auth).catch(err => setAppError("Anonymous sign-in failed."));
            }
        });
    }, [appError]);

    useEffect(() => {
        if (!isReady) return;
        const plantsUnsub = onSnapshot(collection(db, `artifacts/${appId}/public/data/plants`), 
            snapshot => setPlants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
            err => setAppError("Failed to fetch plant data.")
        );
        const faqsUnsub = onSnapshot(collection(db, `artifacts/${appId}/public/data/faqs`),
            snapshot => setFaqs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
            err => console.error("Failed to fetch FAQs.")
        );
        return () => {
            plantsUnsub();
            faqsUnsub();
        };
    }, [isReady]);

    if (appError) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-red-50 text-center">
                <div className="p-8 bg-white shadow-lg rounded-lg">
                    <h1 className="text-2xl font-bold text-red-700 mb-4">Application Error</h1>
                    <p className="text-gray-700">{appError}</p>
                </div>
            </div>
        );
    }

    if (!isReady) {
        return <div className="w-full h-screen flex items-center justify-center"><p className="text-xl font-semibold">Loading Your Beautiful Shop...</p></div>
    }

    let pageContent;
    switch (currentPage) {
        case 'products': pageContent = <ProductsPage plants={plants} />; break;
        case 'cart': pageContent = <CartPage />; break;
        case 'help': pageContent = <HelpPage faqs={faqs} />; break;
        default: pageContent = <HomePage plants={plants.slice(0, 2)} />;
    }

    return (
        <PageContext.Provider value={{ setCurrentPage }}>
            <div className="min-h-screen bg-gradient-to-br from-green-100 via-lime-50 to-yellow-50 font-sans text-gray-800 flex flex-col">
                <Header />
                <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">{pageContent}</main>
                <Footer />
            </div>
        </PageContext.Provider>
    );
}

// --- Reusable Components ---
const Header = () => {
    const { setCurrentPage } = useContext(PageContext);
    return (
        <header className="bg-green-700 text-white shadow-lg sticky top-0 z-50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
                <img src="https://i.imgur.com/YgA5z52.png" alt="The Greenhouse Gang Logo" className="h-14 sm:h-16 cursor-pointer" onClick={() => setCurrentPage('home')} />
                <nav className="flex items-center space-x-2 sm:space-x-4 text-sm sm:text-base">
                    <button onClick={() => setCurrentPage('home')} className="hover:bg-green-600 p-2 rounded-md transition-colors">Home</button>
                    <button onClick={() => setCurrentPage('products')} className="hover:bg-green-600 p-2 rounded-md transition-colors">Our Plants</button>
                    <button onClick={() => setCurrentPage('help')} className="hover:bg-green-600 p-2 rounded-md transition-colors">Help & FAQ</button>
                    <CartButton />
                </nav>
            </div>
        </header>
    );
};

const Footer = () => (
    <footer className="bg-green-800 text-green-100 py-8 text-center mt-8">
        <p className="text-lg font-semibold">The Greenhouse Gang Plant Nursery</p>
        <p className="text-sm">&copy; {new Date().getFullYear()} - Registered Plant Nursery in Florida.</p>
    </footer>
);

const CartButton = () => {
    const { cartItems } = useContext(CartContext);
    const { setCurrentPage } = useContext(PageContext);
    const totalItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);
    return (
        <button onClick={() => setCurrentPage('cart')} className="hover:bg-green-600 p-2 rounded-md transition-colors relative flex items-center">
            <ShoppingCartIcon />
            {totalItems > 0 && <span className="absolute -top-1 -right-1 bg-yellow-400 text-green-800 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{totalItems}</span>}
        </button>
    );
};

const ProductCard = ({ plant, showLimitedInfo = false }) => {
    const { addToCart } = useContext(CartContext);
    const price = typeof plant.price === 'number' ? plant.price : 0;
    return (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col group">
            <img src={plant.imageUrl || 'https://placehold.co/400x400/A2D9A1/4F7942?text=Plant+Image'} alt={plant.name} className="w-full h-56 object-cover" />
            <div className="p-5 flex flex-col flex-grow">
                <h3 className="text-xl font-semibold text-green-700">{plant.name || "Unnamed Plant"}</h3>
                {!showLimitedInfo && <p className="text-gray-600 text-sm mt-2 flex-grow">{plant.description || "No description available."}</p>}
                <div className="mt-4 flex justify-between items-center">
                    <p className="text-2xl font-bold text-yellow-500">${price.toFixed(2)}</p>
                    <button onClick={() => addToCart(plant)} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg">Add to Cart</button>
                </div>
            </div>
        </div>
    );
};

// --- Page Components ---
const HomePage = ({ plants }) => {
    const { setCurrentPage } = useContext(PageContext);
    return (
        <div className="text-center">
            <h2 className="text-4xl sm:text-5xl font-bold text-green-700 mb-4">Welcome to The Greenhouse Gang!</h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">Your friendly, family-run nursery bringing a touch of Florida's sunshine to your home with our happy, healthy plants.</p>
            <div className="my-8 bg-white p-8 rounded-xl shadow-lg">
                <h3 className="text-2xl font-semibold text-green-600 mb-4">More Than Just Plants, We're Family</h3>
                <button onClick={() => setCurrentPage('products')} className="bg-yellow-400 hover:bg-yellow-500 text-green-800 font-semibold py-3 px-6 rounded-lg shadow-md">Explore Our Green Gang</button>
            </div>
            <h3 className="text-3xl font-semibold text-green-700 mb-6">Featured Friends</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
                {plants.map(plant => <ProductCard key={plant.id} plant={plant} showLimitedInfo={true} />)}
            </div>
        </div>
    );
};

const ProductsPage = ({ plants }) => {
    if (!plants || plants.length === 0) return <p className="text-center text-xl font-semibold">Our plants are currently tucked away. Please check back soon!</p>;
    return (
        <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-green-700 mb-8 text-center">Our Plant Collection</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
                {plants.map(plant => <ProductCard key={plant.id} plant={plant} />)}
            </div>
        </div>
    );
};

const CartPage = () => {
    const { cartItems, removeFromCart, updateQuantity, clearCart, cartTotal } = useContext(CartContext);
    if (cartItems.length === 0) return <div className="text-center"><h2 className="text-2xl mb-4">Your Cart is Empty</h2></div>
    return (
        <div className="bg-white p-8 rounded-xl shadow-xl">
            <h2 className="text-3xl font-bold text-green-700 mb-6">Your Cart</h2>
            {cartItems.map(item => (
                <div key={item.id} className="flex items-center justify-between border-b py-2">
                    <span className="font-semibold">{item.name}</span>
                    <div className="flex items-center space-x-2">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2 border rounded">-</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 border rounded">+</button>
                    </div>
                    <span>${((item.price || 0) * item.quantity).toFixed(2)}</span>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                </div>
            ))}
            <div className="mt-6 text-right">
                <h3 className="text-2xl font-bold">Total: ${cartTotal.toFixed(2)}</h3>
                <button onClick={() => { alert('Checkout not implemented.'); clearCart(); }} className="mt-4 bg-yellow-400 text-green-800 font-bold py-2 px-8 rounded-lg">Checkout</button>
            </div>
        </div>
    );
};

const HelpPage = ({ faqs }) => {
    return (
        <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-green-700 mb-8 text-center">Help & FAQ</h2>
            <a href="https://thegreenhousegang.com/blog" target="_blank" rel="noopener noreferrer" className="block text-center bg-green-50 p-6 rounded-xl shadow-lg mb-8 hover:bg-green-100">
                <h3 className="text-2xl font-semibold text-green-600">Visit our Plant Care Blog!</h3>
                <p className="text-gray-700 mt-2">For in-depth guides, tips, and tricks to help your plants thrive.</p>
            </a>
            <div className="space-y-4">
                {faqs.map(faq => (
                    <details key={faq.id} className="p-4 bg-white rounded-lg shadow cursor-pointer">
                        <summary className="font-semibold text-lg">{faq.question}</summary>
                        <p className="mt-2 text-gray-700">{faq.answer}</p>
                    </details>
                ))}
            </div>
        </div>
    );
};

export default function ProvidedApp() {
  return (
    <CartProvider>
      <App />
    </CartProvider>
  );
}
