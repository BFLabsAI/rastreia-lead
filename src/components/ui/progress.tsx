import { cn } from '../../lib/utils';

interface ProgressProps {
    value: number; // 0-100
    variant?: 'default' | 'cyan' | 'lime' | 'green' | 'orange' | 'blue';
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    label?: string;
    className?: string;
}

const variantStyles = {
    default: 'bg-primary',
    cyan: 'bg-cyan-500',
    lime: 'bg-lime-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
};

const sizeStyles = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
};

export function Progress({
    value,
    variant = 'default',
    size = 'md',
    showLabel = false,
    label,
    className,
}: ProgressProps) {
    const clampedValue = Math.min(Math.max(value, 0), 100);

    return (
        <div className={cn('w-full', className)}>
            <div className={cn(
                'w-full bg-surface rounded-full overflow-hidden',
                sizeStyles[size]
            )}>
                <div
                    className={cn(
                        'h-full rounded-full transition-all duration-500 ease-out',
                        variantStyles[variant]
                    )}
                    style={{ width: `${clampedValue}%` }}
                />
            </div>
            {showLabel && (
                <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className="text-xs text-gray-400 font-mono">{clampedValue.toFixed(0)}%</span>
                </div>
            )}
        </div>
    );
}
