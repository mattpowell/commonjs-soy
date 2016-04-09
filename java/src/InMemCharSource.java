package commonjssoy;
import com.google.common.io.CharSource;
import java.io.StringReader;
import java.io.Reader;

public class InMemCharSource {
  public static CharSource create(final String contentString) {
    CharSource source = new CharSource() {
      @Override
      public Reader openStream() {
        return new StringReader(contentString);
      }
    };
    return source;
  }
}
