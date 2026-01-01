
const Hero: React.FC = () => {
  return (
    <div className="w-full h-[80vh] flex flex-col justify-center items-center text-center px-4">
      <h1 className="text-white text-5xl md:text-6xl font-bold mb-6 max-w-4xl">
        Empowering Risk Management with <span className="linearGradient">AI-Driven Insights</span>
      </h1>
      <p className="text-white text-lg md:text-l mb-8 max-w-3xl">
        Identify, assess, and mitigate risks effectively. Our platform provides real-time analytics and predictive insights to help you stay ahead in a dynamic risk landscape.
      </p>
      <div className="mt-[10vh]">
        <button className="glass text-white px-6 py-3 mr-4">
          Get Started
        </button>
        <button className="text-white border border-white px-6 py-3 rounded hover:bg-white hover:text-black transition">
          Learn More
        </button>
      </div>
    </div>
    );
};
export default Hero;
