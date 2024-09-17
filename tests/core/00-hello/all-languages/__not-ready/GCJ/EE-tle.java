class Main {

    public static int f (int x) {
        return x;
    }
    
    public static void main (String args[]) throws Exception {
        int a = 2;
        while (f(a) == f(a)) {
            a = (a+1) % 100;
        }
    }
}
