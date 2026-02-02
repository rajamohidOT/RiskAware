const Partners: React.FC = () => {
  return (
    <div className="w-full py-8 md:py-12 flex flex-col items-center px-4">
        <h2 className="text-white text-2xl md:text-3xl font-bold mb-8">Our Trusted Partners</h2>
        <div className="flex flex-wrap justify-center gap-6 md:gap-8 lg:gap-12" style={{marginTop: '-30px'}}>
            <img src="/images/IBM.svg" alt="Partner 1" className="h-16 md:h-24 lg:h-32 w-auto brightness-0 invert hover:brightness-100 hover:invert-0 transition-all"/>
            <img src="/images/microsoft.svg" alt="Partner 2" className="h-16 md:h-24 lg:h-32 w-auto brightness-0 invert hover:brightness-100 hover:invert-0 transition-all"/>
            <img src="/images/nvidia.svg" alt="Partner 3" className="h-16 md:h-24 lg:h-32 w-auto brightness-0 invert hover:brightness-100 hover:invert-0 transition-all"/>
            <img src="/images/linkedin.svg" alt="Partner 4" className="h-16 md:h-24 lg:h-32 w-auto brightness-0 invert hover:brightness-100 hover:invert-0 transition-all"/>
            <img src="/images/amazon.svg" alt="Partner 4" className="h-16 md:h-24 lg:h-32 w-auto brightness-0 invert hover:brightness-100 hover:invert-0 transition-all"/>
        </div>
    </div>
  );
}
export default Partners;