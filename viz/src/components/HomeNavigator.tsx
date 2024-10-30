import { Link } from "react-router-dom";

const HomeNavigator: React.FC = () => {
  return (
    <Link to="/" className="text-xl font-semibold flex items-center gap-3 justify-center">
      <img src="/logo.png" alt="InterProt Logo" className="h-11 w-11" />
      InterProt
    </Link>
  );
};

export default HomeNavigator;
