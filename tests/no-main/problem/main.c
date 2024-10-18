#include <stdio.h>
#include <unistd.h>
#include <string.h>

int main() {
    //This is certainly not the best way to do this
    
    int x;
    scanf("%d", &x);

    int y;
    scanf("%d", &y);

    char buf[10];
    sprintf(buf, "%.1f\n", average(x, y));
    write(1, buf, strlen(buf));
}