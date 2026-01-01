const Partners: React.FC = () => {
  return (
    //create a small section for partners with logos, small centered text with "Our Trusted Partners", and 4 placeholder logos in a row.
    <div className="w-full py-4 flex flex-col items-center">
        <h2 className="text-white text-3xl font-bold mb-8">Our Trusted Partners</h2>
        <div className="flex space-x-8">
            <img src="/partner1.png" alt="Partner 1" className="h-12 w-auto"/>
            <img src="/partner2.png" alt="Partner 2" className="h-12 w-auto"/>
            <img src="/partner3.png" alt="Partner 3" className="h-12 w-auto"/>
            <img src="/partner4.png" alt="Partner 4" className="h-12 w-auto"/>
        </div>
    </div>
  );
}
export default Partners;