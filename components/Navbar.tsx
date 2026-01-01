const Navbar: React.FC = () => {
    return (
        <nav className="w-full h-16 flex items-center justify-between px-8 bg-transparent">
            <div className="flex items-center space-x-4">
                <img src="/logo.png" alt="" className="h-8 w-8"/>
                <span className="text-white font-bold text-xl">RiskAware</span>
            </div>
            <div className="flex space-x-6">
                <button className="text-white hover:text-gray-300">Products</button>
                <button className="text-white hover:text-gray-300">Solutions</button>
                <button className="text-white hover:text-gray-300">Pricing</button>
                <button className="text-white hover:text-gray-300">Partners</button>
            </div>
            <button className="glass text-white px-4 py-2">
                Get a Demo
            </button>
        </nav>
    );
};
export default Navbar;