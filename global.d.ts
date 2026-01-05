import 'preact'

declare module 'preact' {
  namespace JSX {
    interface IntrinsicElements {
      /**
       * The <selectedcontent> element displays a clone of the currently
       * selected <option>'s content inside a customizable <select>.
       */
      selectedcontent: JSX.HTMLAttributes<HTMLElement>
    }
  }
}
