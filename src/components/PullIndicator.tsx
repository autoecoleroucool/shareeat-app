import { forwardRef } from 'react';

const PullIndicator = forwardRef<HTMLDivElement>((_, ref) => (
  <div ref={ref} className="ptr-indicator">
    <div className="ptr-indicator-inner">
      <div className="ptr-spinner" />
      <div className="ptr-arrow">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v9M3 7l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  </div>
));

PullIndicator.displayName = 'PullIndicator';
export default PullIndicator;
