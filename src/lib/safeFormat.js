// Crash-proof drop-in for date-fns `format`.
//
// Two production incidents in one day came from `format(parseISO(x), …)`
// where x was truthy but unparseable — a RangeError inside render kills the
// whole page behind the PageBoundary. This wrapper is swapped in wherever the
// app formats dates for DISPLAY: on any invalid input it renders '' instead
// of throwing. A page must never die because one row carries a bad date.
import {
  format as dfFormat,
  formatDistanceToNowStrict as dfFormatDistanceToNowStrict,
} from 'date-fns'

export function format(date, pattern, options) {
  try {
    return dfFormat(date, pattern, options)
  } catch {
    return ''
  }
}

export function formatDistanceToNowStrict(date, options) {
  try {
    return dfFormatDistanceToNowStrict(date, options)
  } catch {
    return ''
  }
}
