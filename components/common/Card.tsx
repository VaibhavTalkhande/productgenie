
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`bg-dark-card border border-dark-border rounded-lg p-6 shadow-lg ${className}`}
    >
      {children}
    </div>
  );
};
