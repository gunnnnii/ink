import {createContext} from 'react';

export type Props = {
	/**
	 * Exit (unmount) the whole Ink app.
	 */
	readonly exit: (error?: Error) => void;
	/**
	 * Take a screenshot of the current app.
	 */
	readonly screenshot: () => string;
};

/**
 * `AppContext` is a React context, which exposes a method to manually exit the app (unmount).
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
const AppContext = createContext<Props>({
	exit() {},
	screenshot() {
		return '';
	},
});

AppContext.displayName = 'InternalAppContext';

export default AppContext;
