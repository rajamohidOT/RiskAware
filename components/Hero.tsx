
const Hero: React.FC = () => {
  return (
    <div className="w-full h-[80vh] flex flex-col justify-center items-center text-center px-4">
      <h1 className="text-white text-5xl md:text-6xl font-bold mb-6 max-w-4xl">
        Empowering Risk Management with <span className="linearGradient">AI-Driven Insights</span>
      </h1>
      <p className="text-white text-lg md:text-l mb-8 max-w-3xl">
        Identify, assess, and mitigate risks effectively. Our platform provides real-time analytics and predictive insights to help you stay ahead in a dynamic risk landscape.
      </p>
      <div className="mt-[10vh] flex gap-4">

        {/* Primary Button */}
        <button className="px-6 py-3 rounded border border-white bg-white text-black transition-all duration-200 hover:bg-transparent hover:text-white">
          Get Started
        </button>

        {/* Secondary Button */}
        <button className="px-6 py-3 rounded border border-white text-white transition-all duration-200 hover:bg-white hover:text-black">
          Learn More
        </button>

      </div>
    </div>
    );
};
export default Hero;
