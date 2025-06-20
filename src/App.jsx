import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// --- Firebase Configuration ---
// This uses the standard Vite method for accessing environment variables.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

// --- Firebase Services ---
// We will initialize these inside the component to make it more robust.
let app, db, auth;

// This is the hardcoded ID for your app's database structure.
const appId = "greenhouse-gang-nursery";

// --- Cart Context ---
const CartContext = createContext();

const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  const addToCart = (product) => {
    setCartItems(prevItems => {
      const itemExists = prevItems.find(item => item.id === product.id);
      if (itemExists) {
        return prevItems.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevItems, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === productId ? { ...item, quantity: Math.max(1, quantity) } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const cartTotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal }}>
      {children}
    </CartContext.Provider>
  );
};

const useCart = () => useContext(CartContext);

// --- Helper Components ---
const Icon = ({ path, className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const ShoppingCartIcon = () => <Icon path="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />;
const QuestionMarkCircleIcon = () => <Icon path="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />;
const HomeIcon = () => <Icon path="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h7.5" />;
const CollectionIcon = () => <Icon path="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />

// --- Main App Component ---
function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [plants, setPlants] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showAddedToCartMessage, setShowAddedToCartMessage] = useState(false);
  const [messageProduct, setMessageProduct] = useState('');

  // Firebase Initialization and Auth Listener
  useEffect(() => {
    try {
      // Check if Firebase has already been initialized
      if (!app) {
        // Initialize Firebase services only once.
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
      }

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
              setIsAuthReady(true);
          } else {
              try {
                  await signInAnonymously(auth);
              } catch (e) {
                  console.error("Anonymous sign-in error:", e);
                  setError("Failed to initialize user session.");
              }
          }
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Firebase initialization failed:", e);
      setError("Critical error connecting to the database. Please check environment variables.");
      setIsLoading(false);
    }
  }, []);

  // Fetch Data (Plants & FAQs)
  useEffect(() => {
    if (!isAuthReady) return;

    setIsLoading(true);
    const plantsCollectionPath = `artifacts/${appId}/public/data/plants`;
    const faqsCollectionPath = `artifacts/${appId}/public/data/faqs`;
    
    const plantsCol = collection(db, plantsCollectionPath);
    const faqsCol = collection(db, faqsCollectionPath);

    const unsubscribePlants = onSnapshot(plantsCol, (snapshot) => {
      const plantsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPlants(plantsList);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching plants: ", err);
      setError("Could not load plant data. Please check back soon.");
      setIsLoading(false);
    });
    
    const unsubscribeFaqs = onSnapshot(faqsCol, (snapshot) => {
      const faqsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFaqs(faqsList);
    }, (err) => {
      console.error("Error fetching FAQs: ", err);
    });

    return () => {
        unsubscribePlants();
        unsubscribeFaqs();
    };
  }, [isAuthReady]);

  const renderPage = () => {
    switch (currentPage) {
        case 'home':
            return <HomePage setCurrentPage={setCurrentPage} plants={plants.slice(0, 2)} isLoading={isLoading} error={error} />;
        case 'products':
            return <ProductsPage plants={plants} isLoading={isLoading} error={error} setShowAddedToCartMessage={setShowAddedToCartMessage} setMessageProduct={setMessageProduct} />;
        case 'cart':
            return <CartPage setCurrentPage={setCurrentPage} />;
        case 'help':
            return <HelpPage faqs={faqs} />;
        default:
            return <HomePage setCurrentPage={setCurrentPage} plants={plants.slice(0, 2)} isLoading={isLoading} error={error} />;
    }
  };

  const { cartItems } = useCart();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 via-lime-50 to-yellow-50 font-sans text-gray-800 flex flex-col">
        <header className="bg-green-700 text-white shadow-lg sticky top-0 z-50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row justify-between items-center">
            <div 
                className="flex items-center cursor-pointer mb-2 sm:mb-0"
                onClick={() => setCurrentPage('home')}
            >
                <img
                src="https://i.imgur.com/YgA5z52.png" 
                alt="The Greenhouse Gang Logo"
                className="h-14 sm:h-16"
                onError={(e) => {
                    e.target.onerror = null; 
                    e.target.src="https://placehold.co/200x60/FFFFFF/4F7942?text=The+Greenhouse+Gang&font=lora";
                }}
                />
            </div>
            <nav className="flex space-x-3 sm:space-x-4 text-sm sm:text-base">
                <button onClick={() => setCurrentPage('home')} className="hover:bg-green-600 p-2 rounded-md transition-colors duration-200 flex items-center space-x-1"><HomeIcon className="w-5 h-5"/><span>Home</span></button>
                <button onClick={() => setCurrentPage('products')} className="hover:bg-green-600 p-2 rounded-md transition-colors duration-200 flex items-center space-x-1"><CollectionIcon className="w-5 h-5"/><span>Our Plants</span></button>
                <button onClick={() => setCurrentPage('help')} className="hover:bg-green-600 p-2 rounded-md transition-colors duration-200 flex items-center space-x-1"><QuestionMarkCircleIcon className="w-5 h-5"/><span>Help & FAQ</span></button>
                <button onClick={() => setCurrentPage('cart')} className="hover:bg-green-600 p-2 rounded-md transition-colors duration-200 relative flex items-center space-x-1">
                <ShoppingCartIcon className="w-5 h-5"/>
                <span>Cart</span>
                {cartItems.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-yellow-400 text-green-800 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {cartItems.reduce((acc, item) => acc + item.quantity, 0)}
                    </span>
                )}
                </button>
            </nav>
            </div>
        </header>

        {showAddedToCartMessage && (
            <div className="fixed top-20 right-5 bg-green-500 text-white p-3 rounded-lg shadow-md z-50 animate-pulse-once">
            {messageProduct} added to cart!
            </div>
        )}

        <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {renderPage()}
        </main>

        <footer className="bg-green-800 text-green-100 py-8 text-center">
            <div className="container mx-auto px-4">
            <p className="text-lg font-semibold mb-2">The Greenhouse Gang Plant Nursery</p>
            <p className="text-sm mb-1">&copy; {new Date().getFullYear()} - Nurturing Green Friends Together.</p>
            <p className="text-xs mb-2">Registered Plant Nursery in Florida.</p>
            <p className="text-xs">
                Questions? Email us at <a href="mailto:hello@greenhousegang.com" className="underline hover:text-yellow-300">hello@greenhousegang.com</a>
            </p>
            </div>
        </footer>
    </div>
  );
}

// --- Page Components ---
const HomePage = ({ setCurrentPage, plants, isLoading, error }) => {
  return (
    <div className="text-center">
      <header className="mb-12">
        <h2 className="text-4xl sm:text-5xl font-bold text-green-700 mb-4">Welcome to The Greenhouse Gang!</h2>
        <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
          Your friendly, family-run nursery bringing a touch of Florida's sunshine to your home with our happy, healthy plants.
        </p>
      </header>
      <section className="mb-12 bg-white p-6 sm:p-8 rounded-xl shadow-lg">
        <h3 className="text-2xl font-semibold text-green-600 mb-4">More Than Just Plants, We're Family</h3>
        <p className="text-gray-700 mb-3">
          As a registered plant nursery right here in Florida, we're passionate about connecting people with the joy of plants. We're a small team with big hearts, dedicated to providing you with quality greenery and the support you need to help it thrive.
        </p>
        <button 
          onClick={() => setCurrentPage('products')}
          className="bg-yellow-400 hover:bg-yellow-500 text-green-800 font-semibold py-3 px-6 rounded-lg shadow-md transition-transform duration-150 hover:scale-105"
        >
          Explore Our Green Gang
        </button>
      </section>
      <section className="mb-12">
        <h3 className="text-3xl font-semibold text-green-700 mb-6">Featured Friends</h3>
        {isLoading && <p className="text-gray-600">Loading our favorite plants...</p>}
        {error && <p className="text-red-500 p-4 bg-red-100 rounded-lg">{error}</p>}
        {!isLoading && !error && plants && plants.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
            {plants.map(plant => (
              <ProductCard key={plant.id} plant={plant} showLimitedInfo={true} />
            ))}
          </div>
        )}
         {!isLoading && !error && (!plants || plants.length === 0) && (
          <p className="text-gray-600">Our featured plants are shy today! Check back soon or browse all plants.</p>
        )}
      </section>
      <section className="bg-green-50 p-6 sm:p-8 rounded-xl shadow">
        <h3 className="text-2xl font-semibold text-green-600 mb-3">Need Plant Care Tips?</h3>
        <p className="text-gray-700 mb-4">
          Visit our <a href="https://your-blog-website.com/plant-care" target="_blank" rel="noopener noreferrer" className="text-green-700 underline hover:text-yellow-500 font-semibold">Plant Care Corner</a> for advice, or check out our FAQs.
        </p>
        <button 
          onClick={() => setCurrentPage('help')}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-transform duration-150 hover:scale-105"
        >
          Visit Help & FAQ
        </button>
      </section>
    </div>
  );
};

const ProductsPage = ({ plants, isLoading, error, setShowAddedToCartMessage, setMessageProduct }) => {
  const { addToCart } = useCart();
  const handleAddToCart = (plant) => {
    addToCart(plant);
    setMessageProduct(plant.name);
    setShowAddedToCartMessage(true);
    setTimeout(() => setShowAddedToCartMessage(false), 3000);
  };
  if (isLoading) return <p className="text-center text-gray-600 text-xl">Loading our beautiful plants...</p>;
  if (error) return <p className="text-center text-red-500 text-xl p-4 bg-red-100 rounded-lg">{error}</p>;
  if (!plants || plants.length === 0) return <p className="text-center text-gray-600 text-xl">No plants available at the moment. Please check back soon!</p>;
  return (
    <div>
      <h2 className="text-3xl sm:text-4xl font-bold text-green-700 mb-8 text-center">Our Plant Collection</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
        {plants.map(plant => (
          <ProductCard key={plant.id} plant={plant} onAddToCart={handleAddToCart} />
        ))}
      </div>
    </div>
  );
};

const ProductCard = ({ plant, onAddToCart, showLimitedInfo = false }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col transition-all duration-300 hover:shadow-2xl group">
      <img 
        src={plant.imageUrl || `https://placehold.co/400x300/A2D9A1/4F7942?text=${encodeURIComponent(plant.name)}`} 
        alt={plant.name} 
        className="w-full h-48 sm:h-56 object-cover group-hover:scale-105 transition-transform duration-300"
        onError={(e) => e.target.src = `https://placehold.co/400x300/E0E0E0/757575?text=Image+Error`}
      />
      <div className="p-4 sm:p-5 flex flex-col flex-grow">
        <h3 className="text-xl sm:text-2xl font-semibold text-green-700 mb-2">{plant.name}</h3>
        {!showLimitedInfo && <p className="text-gray-600 text-sm mb-3 flex-grow">{plant.description}</p>}
        {!showLimitedInfo && (
          <div className="mb-4 text-xs text-gray-500 space-y-1">
            <p><strong className="text-green-600">Care:</strong> {plant.careLevel}</p>
            <p><strong className="text-green-600">Light:</strong> {plant.lightNeeds}</p>
            <p><strong className="text-green-600">Water:</strong> {plant.waterNeeds}</p>
          </div>
        )}
         <p className="text-2xl font-bold text-yellow-500 mb-4">${plant.price.toFixed(2)}</p>
        {onAddToCart && plant.stock > 0 && (
          <button 
            onClick={() => onAddToCart(plant)}
            className="mt-auto w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
          >
            Add to Cart
          </button>
        )}
        {plant.stock === 0 && (
           <p className="mt-auto w-full text-center bg-gray-200 text-gray-500 font-semibold py-2 px-4 rounded-lg">Out of Stock</p>
        )}
      </div>
    </div>
  );
};

const CartPage = ({ setCurrentPage }) => {
  const { cartItems, removeFromCart, updateQuantity, clearCart, cartTotal } = useCart();
  if (cartItems.length === 0) {
    return (
      <div className="text-center">
        <h2 className="text-3xl font-bold text-green-700 mb-6">Your Cart is Empty</h2>
        <p className="text-gray-600 mb-6">Looks like you haven't added any green buddies yet!</p>
        <button 
          onClick={() => setCurrentPage('products')}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition-transform duration-150 hover:scale-105"
        >
          Browse Plants
        </button>
      </div>
    );
  }
  const handleCheckout = () => {
    alert(`Thank you for your order of $${cartTotal.toFixed(2)}! (This is a demo checkout)`);
    clearCart();
    setCurrentPage('home');
  };
  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl">
      <h2 className="text-3xl sm:text-4xl font-bold text-green-700 mb-8">Your Shopping Cart</h2>
      {cartItems.map(item => (
        <div key={item.id} className="flex flex-col sm:flex-row items-center justify-between border-b border-gray-200 py-4 mb-4">
          <div className="flex items-center mb-4 sm:mb-0">
            <img 
              src={item.imageUrl || `https://placehold.co/100x100/A2D9A1/4F7942?text=${encodeURIComponent(item.name)}`} 
              alt={item.name} 
              className="w-20 h-20 object-cover rounded-lg mr-4 shadow"
              onError={(e) => e.target.src = `https://placehold.co/100x100/E0E0E0/757575?text=Img+Err`}
            />
            <div>
              <h3 className="text-lg font-semibold text-green-700">{item.name}</h3>
              <p className="text-gray-600">${item.price.toFixed(2)}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center border border-gray-300 rounded-md">
              <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-3 py-1 text-lg text-gray-700 hover:bg-gray-100 rounded-l-md">-</button>
              <span className="px-4 py-1 text-gray-800">{item.quantity}</span>
              <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-3 py-1 text-lg text-gray-700 hover:bg-gray-100 rounded-r-md">+</button>
            </div>
            <p className="text-lg font-semibold w-20 text-right">${(item.price * item.quantity).toFixed(2)}</p>
            <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-700 transition-colors">
              <Icon path="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0c1.153 0 2.242.078 3.223.224M5 5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2H5z" className="w-5 h-5" />
            </button>
          </div>
        </div>
      ))}
      <div className="mt-8 text-right">
        <h3 className="text-2xl font-bold text-gray-800">Total: ${cartTotal.toFixed(2)}</h3>
        <div className="mt-6 space-y-3 sm:space-y-0 sm:space-x-4 flex flex-col sm:flex-row sm:justify-end">
           <button 
            onClick={clearCart}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg shadow transition-colors"
          >
            Clear Cart
          </button>
          <button 
            onClick={handleCheckout}
            className="bg-yellow-400 hover:bg-yellow-500 text-green-800 font-bold py-3 px-8 rounded-lg shadow-lg transition-transform duration-150 hover:scale-105"
          >
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  );
};

const HelpPage = ({ faqs }) => {
  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-3xl sm:text-4xl font-bold text-green-700 mb-8 text-center">Help & Frequently Asked Questions</h2>
      <section className="mb-10 p-6 bg-green-50 rounded-xl shadow-lg text-center">
        <h3 className="text-2xl font-semibold text-green-600 mb-3">Plant Care Guidance</h3>
        <p className="text-gray-700 mb-4">
          Looking for tips on how to keep your new green friends thriving? Our Plant Care Corner blog is packed with helpful articles and guides!
        </p>
        <a 
          href="https://your-blog-website.com/plant-care"
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-transform duration-150 hover:scale-105"
        >
          Visit Our Plant Care Blog
        </a>
        <p className="text-xs text-gray-500 mt-2">(This will open in a new tab)</p>
      </section>
      <section>
        <h3 className="text-2xl font-semibold text-green-600 mb-6 text-center">Common Questions</h3>
        {(!faqs || faqs.length === 0) && (
          <p className="text-gray-600 text-center">Loading FAQs or no FAQs available yet. We're working on it!</p>
        )}
        <div className="space-y-6">
          {faqs.map(faq => (
            <FAQItem key={faq.id} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </section>
    </div>
  );
};

const FAQItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 sm:p-5 text-left text-gray-700 hover:bg-gray-50 focus:outline-none"
      >
        <span className="text-md sm:text-lg font-semibold">{question}</span>
        <Icon path={isOpen ? "M19.5 12h-15" : "M12 4.5v15m7.5-7.5h-15"} className="w-5 h-5 text-green-600 transform transition-transform duration-200" style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(0deg)' }} />
      </button>
      {isOpen && (
        <div className="p-4 sm:p-5 border-t border-gray-200 bg-gray-50">
          <p className="text-gray-600 text-sm sm:text-base leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
};

// Default export: The main App component wrapped with CartProvider
export default function ProvidedApp() {
  return (
    <CartProvider>
      <App />
    </CartProvider>
  );
}
