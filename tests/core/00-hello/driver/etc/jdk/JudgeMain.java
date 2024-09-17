// JDK wrapper to correct Jutge submissions

class JudgeMain {

    public static void main (String[] args) {
        try {
            Main.main(args);
            System.exit(0);
        } catch (Throwable e) {
            // We hide the exception.
            // System.out.println(e);
            System.exit(1);
        }
    }

}
