import React from 'react';
import { render, Text, Box, PixelTransform } from '../src/index.js';
import chalk from 'chalk';

function App() {
  return (
    <Box flexDirection="column">
      <Box>
        <Text>Hello there, this is a test!</Text>
        <PixelTransform
          range={[{ x: 2, y: 0 }, { x: 6, y: 0 }]}
          transform={string => chalk.inverse(string)}
        />
      </Box>

      <Box marginTop={1}>
        <Text>Another line with different styling</Text>
        <PixelTransform
          range={[{ x: 8, y: 1 }]}
          transform={string => chalk.bold.red(string)}
        />
      </Box>

      <Box marginTop={1}>
        <Text color="blue">Multi-line transformation:</Text>
      </Box>
      <Box>
        <Text>Line 1</Text>
      </Box>
      <Box>
        <Text>Line 2</Text>
      </Box>
      <PixelTransform
        range={[{ x: 3, y: 3 }, { x: 2, y: 4 }]}
        transform={string => chalk.bgYellow.black(string)}
      />
    </Box>
  );
}

render(<App />); 