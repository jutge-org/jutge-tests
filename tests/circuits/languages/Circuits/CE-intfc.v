module bus_invert (
  input [7:0] in,
  output [7:0] no_out
);
  assign no_out = ~ in;
endmodule
