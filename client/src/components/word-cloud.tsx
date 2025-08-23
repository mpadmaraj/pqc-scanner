interface WordCloudData {
  library: string;
  count: number;
}

interface WordCloudProps {
  data: WordCloudData[];
}

export default function WordCloud({ data }: WordCloudProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        No crypto libraries data available
      </div>
    );
  }

  const maxCount = Math.max(...data.map(item => item.count));
  const minCount = Math.min(...data.map(item => item.count));
  const range = maxCount - minCount || 1;

  const getFontSize = (count: number) => {
    const normalizedSize = ((count - minCount) / range);
    return 12 + (normalizedSize * 24); // Font size between 12px and 36px
  };

  const getOpacity = (count: number) => {
    const normalizedOpacity = ((count - minCount) / range);
    return 0.5 + (normalizedOpacity * 0.5); // Opacity between 0.5 and 1.0
  };

  const colors = [
    'text-blue-600', 'text-green-600', 'text-purple-600', 'text-red-600',
    'text-yellow-600', 'text-indigo-600', 'text-pink-600', 'text-teal-600'
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 p-4 min-h-40 bg-muted/20 rounded-lg">
      {data.map((item, index) => (
        <span
          key={item.library}
          className={`font-medium cursor-pointer hover:scale-110 transition-transform ${colors[index % colors.length]}`}
          style={{
            fontSize: `${getFontSize(item.count)}px`,
            opacity: getOpacity(item.count),
          }}
          title={`${item.library}: ${item.count} occurrences`}
          data-testid={`word-cloud-item-${item.library.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {item.library}
        </span>
      ))}
    </div>
  );
}