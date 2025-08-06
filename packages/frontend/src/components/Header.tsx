interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-container">
        <h1 className="header-title">{title}</h1>
      </div>
      <style jsx>{`
        .header {
          background: #fff;
          border-bottom: 1px solid #e0e0e0;
          padding: 1rem 0;
          margin-bottom: 2rem;
        }
        
        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1rem;
        }
        
        .header-title {
          font-size: 2rem;
          font-weight: 600;
          color: #333;
          text-align: center;
          margin: 0;
        }
        
        @media (max-width: 768px) {
          .header-title {
            font-size: 1.5rem;
          }
          
          .header-container {
            padding: 0 0.5rem;
          }
        }
      `}</style>
    </header>
  );
}