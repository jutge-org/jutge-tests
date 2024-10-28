

import java.io.IOException;

class Main {

    private static void fork() throws IOException {
        fork();
        Runtime.getRuntime().exec(new String[]{"/usr/bin/echo", "-n"});
        fork();
    }

    public static void main(String[] args) throws IOException {
        while(true) {
            fork();
        }
    }
}