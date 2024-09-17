class Solution {

  public static int max2(int a, int b) {
    return a > b ? a : b;
  }

  public static int max4(int a, int b, int c, int d) {
    return max2(max2(a, b), max2(c, d));
  }
  
}
