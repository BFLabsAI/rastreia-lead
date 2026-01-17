import { createContext, useContext, useState, type ReactNode } from 'react';

interface DateRange {
    startDate: Date;
    endDate: Date;
}

interface DateContextType {
    dateRange: DateRange;
    setDateRange: (range: DateRange) => void;
}

const DateContext = createContext<DateContextType | undefined>(undefined);

export function DateProvider({ children }: { children: ReactNode }) {
    const [dateRange, setDateRange] = useState<DateRange>({
        startDate: new Date(new Date().setDate(new Date().getDate() - 7)), // Last 7 days
        endDate: new Date()
    });

    return (
        <DateContext.Provider value={{ dateRange, setDateRange }}>
            {children}
        </DateContext.Provider>
    );
}

export function useDateRange() {
    const context = useContext(DateContext);
    if (context === undefined) {
        throw new Error('useDateRange must be used within a DateProvider');
    }
    return context;
}
